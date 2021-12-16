/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2021 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Plugin,
  PluginContext,
  KuzzleRequest,
  JSONObject,
  BadRequestError
} from 'kuzzle';

import _ from 'lodash';

import { MetricService } from './services/MetricService';

/**
 * Promtheus Plugin configuration type
 * @type {PromtheusPluginConfig}
 * @private
 */
export type PluginConfiguration = {
  metrics: {
    core: {
      /**
       * Enable or disable request duration metrics
       * This is a plugin provided metric using Kuzzle hooks on request:* events
       */
      monitorRequestDuration: boolean;

      /**
       * String to prefix core metrics with
       * @default 'kuzzle_'
       */
      prefix: string;
    },
    default: {
      /**
       * Enable or disable the Node.js process metrics (EventLoop lags, GC, CPU, RAM etc...)
       * @default true
       */
      enabled: boolean;

      /**
       * The event loop monitoring sampling rate in milliseconds
       * @default 10
       */
      eventLoopMonitoringPrecision: number;

      /**
       * The custom buckets for GC duration histogram in seconds
       * @default [0.001,0.01,0.1,1,2,5]
       */
      gcDurationBuckets: number[];

      /**
       * String to prefix default metrics with
       * @default 'kuzzle_'
       */
      prefix: string;
    }
  };
}

/**
 * @class PrometheusPlugin
 *
 * @property {PluginConfiguration}     config         Plugin configuration
 * @property {KuzzlePluginContext}     context        Kuzzle plugin context
 * @property {Object.<string, string>} hooks          Kuzzle plugin hooks
 * @property {Object.<string, string>} pipes          Kuzzle plugin pipes
 * @property {MetricService}           metricService  Metric service
 *
 * @externs
 */
export class PrometheusPlugin extends Plugin {
  public config: PluginConfiguration;
  public context: PluginContext;
  public _manifest: any;

  /**
   * Service to manage, update and format Prometheus metrics
   */
  private metricService: MetricService;

  constructor() {
    super({
      kuzzleVersion: '>=2.16.0 <3'
    });

    /**
     * Default plugin configuration
     */
    this.config = {
      metrics: {
        default: {
          enabled: true,
          prefix: 'kuzzle_',
          eventLoopMonitoringPrecision: 10,
          gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        },
        core: {
          monitorRequestDuration: true,
          prefix: 'kuzzle_',
        }
      }
    };
  }

  /**
   * Plugin initialization
   * @param {PluginConfiguration} config  - Plugin configuration
   * @param {PluginContext}       context - Kuzzle plugin context
   */
  async init(config: PluginConfiguration, context: PluginContext) {
    this.config = _.merge(this.config, config);
    this.context = context;

    this.pipes = {
      'server:afterMetrics': async request => this.guard(request, this.pipeFormatMetrics.bind(this)),
    };

    this.hooks = {
      'request:on*': this.recordRequest.bind(this),
      //'request:onError': (request, event) => this.prometheusController.recordRequests(request, event)
    };

    /**
     * This route intend to be used by legacy Prometheus server and avoid
     * not very necessary changes in their configurations. As it predecessor, works only with HTTP
     * NOTE: I didn't make a dedicated controller for it since it's just retrocompatibility item.
     * @deprecated
     */
    this.api = {
      prometheus: {
        actions: {
          metrics: {
            handler: async request => this.guard(request, this.metrics.bind(this)),
          }
        }
      }
    };


    this.metricService = new MetricService(this.config as PluginConfiguration);
  }

  /**
   * On server:afterMetrics hook, format the metrics and send them to the client as Prometheus format
   * @param {KuzzleRequest} request - Kuzzle request
   * @returns {KuzzleRequest}
   */
  async pipeFormatMetrics(request: KuzzleRequest): Promise<KuzzleRequest> {
    if (request.input.args['format'] || request.input.args['format'] === 'prometheus') {
      request = await this.prepareResponseWithMetrics(request, request.response.result);
    }

    return request;
  }

  /**
   * This route intend to be used by legacy Prometheus server and avoid
   * not very impactful changes in their configurations. As it predecessor, works only with HTTP
   * @param {KuzzleRequest} request - Kuzzle request
   * @returns {Promise<KuzzleRequest>}
   * @deprecated
   */
  async metrics(request: KuzzleRequest): Promise<string> {
    if (request.context.connection.protocol === 'http') {
      // TODO: Update to regular Kuzzle server:metrics request when it will be available
      const { result } = await this.context.accessors.sdk.server.metrics();

      request = await this.prepareResponseWithMetrics(request, result);

      return request.response.result;
    }
  }

  /**
   * Log the response time for the given request in the associated metric
   * @param {KuzzleRequest} request - Kuzzle request
   */
  recordRequest(request: KuzzleRequest): void {
    this.metricService.recordResponseTime(
      Date.now() - request.timestamp,
      {
        action: request.input.action,
        controller: request.input.controller,
        protocol: request.context.connection.protocol,
        status: request.status
      }
    );
  }

  /**
   * Update the given request to set correct Content-Type and result
   * @param {KuzzleRequest} request - Kuzzle request
   * @param {JSONObject}    result  - Kuzzle result
   * @returns {Promise<KuzzleRequest>}
   */
  private async prepareResponseWithMetrics(request: KuzzleRequest, jsonMetrics: JSONObject): Promise<KuzzleRequest> {
    // coreMetrics need to be updated with Kuzzle core values before the metrics are sent to the client
    this.metricService.updateCoreMetrics(jsonMetrics);

    request.response.configure({
      headers: {
        'Content-Type': this.metricService.getPrometheusContentType()
      },
      format: 'raw',
    });
    request.response.result = await this.metricService.getMetrics();

    return request;
  }

  /**
   * Ensure Plugin feature only respond to HTTP requests
   * @param {KuzzleRequest} request - Kuzzle request
   * @param {Function}      next    - Next function
   */
  private guard(request: KuzzleRequest, next: (request: KuzzleRequest) => Promise<string>): Promise<string> {
    if (request.context.connection.protocol !== 'http') {
      throw new BadRequestError('Prometheus plugin is only compatible with HTTP protocol');
    }
    return next(request);
  }
}
