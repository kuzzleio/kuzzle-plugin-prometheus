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
} from 'kuzzle';

import _ from 'lodash';

import { MetricService } from './services/MetricService';

/**
 * Promtheus Plugin configuration type
 */
export type PrometheusPluginConfiguration = {
  metrics: {
    core: {
      /**
       * Enable or disable request duration metrics
       * This is a plugin provided metric using Kuzzle hooks on request:* events
       * @default true
       */
      monitorRequestDuration?: boolean;

      /**
       * String to prefix core metrics with
       * @default 'kuzzle_'
       */
      prefix?: string;
    },
    default: {
      /**
       * Enable or disable the Node.js process metrics (EventLoop lags, GC, CPU, RAM etc...)
       * @default true
       */
      enabled?: boolean;

      /**
       * The event loop monitoring sampling rate in milliseconds
       * @default 10
       */
      eventLoopMonitoringPrecision?: number;

      /**
       * The custom buckets for GC duration histogram in seconds
       * @default [0.001,0.01,0.1,1,2,5]
       */
      gcDurationBuckets?: number[];

      /**
       * String to prefix default metrics with
       * @default 'kuzzle_'
       */
      prefix?: string;
    }
  };
}

/**
 * @class PrometheusPlugin
 *
 * @property {PluginConfiguration}     config         Plugin configuration
 * @property {MetricService}           metricService  Metric service
 *
 * @externs
 */
export class PrometheusPlugin extends Plugin {
  /**
   * Plugin configuration validation
   */
  public config: PrometheusPluginConfiguration;

  /**
   * Service to manage, update and format Prometheus metrics
   */
  private metricService: MetricService;

  constructor () {
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
   * @param {PrometheusPluginConfiguration} config  - Plugin configuration
   * @param {PluginContext}       context - Kuzzle plugin context
   */
  async init (config: PrometheusPluginConfiguration, context: PluginContext) {
    this.config = _.merge(this.config, config);
    this.context = context;

    this.pipes = {
      'server:afterMetrics': async (request: KuzzleRequest) => this.pipeFormatMetrics(request),
    };

    this.hooks = {
      'request:on*': this.recordRequest.bind(this),
    };

    this.metricService = new MetricService(this.config);
  }

  /**
   * On server:afterMetrics hook, format the metrics and send them to the client as Prometheus format
   * @param {KuzzleRequest} request - Kuzzle request
   * @returns {KuzzleRequest}
   */
  async pipeFormatMetrics (request: KuzzleRequest): Promise<KuzzleRequest> {
    if (request.getString('format', 'invalid') === 'prometheus') {
      // coreMetrics need to be updated with Kuzzle core values before the metrics are sent to the client
      this.metricService.updateCoreMetrics(request.response.result);
      request.response.configure({
        headers: {
          'Content-Type': this.metricService.getPrometheusContentType()
        },
        format: 'raw',
      });
      request.response.result = await this.metricService.getMetrics();
    }
    return request;
  }

  /**
   * Log the response time for the given request in the associated metric
   * @param {KuzzleRequest} request - Kuzzle request
   */
  recordRequest (request: KuzzleRequest): void {
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
}
