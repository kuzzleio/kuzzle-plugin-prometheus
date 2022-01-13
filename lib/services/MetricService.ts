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

import { JSONObject } from 'kuzzle';
import { Gauge, Registry, collectDefaultMetrics, Histogram } from 'prom-client';
import { PrometheusPluginConfiguration } from '../PrometheusPlugin';

/**
 * Core metrics type definition
 */
export type CoreMetrics = {
  api: {
    /**
     * Concurrent requests being processed
     */
    concurrentRequests: Gauge<string>;

    /**
     * Number of requests waiting to be processed
     */
    pendingRequests: Gauge<string>;
  },
  network: {
    /**
     * Number of active connections per protocol using labels
     */
    connections: Gauge<string>;
  },
  realtime: {
    /**
     * Number of active realtime rooms
     * @see https://docs.kuzzle.io/core/2/guides/main-concepts/realtime-engine
     */
    rooms: Gauge<string>;

    /**
     * Number of active realtime subscriptions
     * @see https://docs.kuzzle.io/core/2/guides/main-concepts/realtime-engine
     */
    subscriptions: Gauge<string>
  }
};


/**
 * MetricService is a service to handle metrics from the Kuzzle API and the application.
 * @property {{ core: CoreMetrics, requestDuration?: Histogram<string> }} metrics     - The application metrics to register.
 * @property {{[key: string]: Registry}}                                  registries  - The Prometheus registry to register metrics.
 */
export class MetricService {
  /**
   * A set of metrics matching the Kuzzle server:metrics action reponse
   * @property {CoreMetrics} core            - The core metrics to register.
   * @property {Histogram}   requestDuration - The application metrics to register.
   */
  private metrics: { core: CoreMetrics, requestDuration?: Histogram<string> };

  /**
   * The Prometheus registries used to register metrics and format them
   * @property {Registry} core              - The core metrics registry
   * @property {Registry} default           - The default metrics registry (if enabled)
   * @property {Registry} requestDuration   - The default metrics registry (if enabled)
   */
  private registries: { core: Registry, default?: Registry, requestDuration?: Registry };

  /**
   * @param {PrometheusPluginConfiguration} config - The plugin configuration
   */
  constructor (config: PrometheusPluginConfiguration) {
    this.registries = {
      core: new Registry(),
    };

    this.metrics = {
      core: {
        api: {
          concurrentRequests: new Gauge({ 
            name: `${config.metrics.core.prefix}api_concurrent_requests`, 
            help: 'Number of concurrent requests', 
            registers: [this.registries.core] 
          }),
          pendingRequests: new Gauge({ 
            name: `${config.metrics.core.prefix}api_pending_requests`, 
            help: 'Number of pending requests', 
            registers: [this.registries.core] 
          }),
        },
        network: {
          connections: new Gauge({ 
            name: `${config.metrics.core.prefix}network_connections`,
            help: 'Number of connections', 
            labelNames: ['protocol'], 
            registers: [this.registries.core] 
          }),
        },
        realtime: {
          rooms: new Gauge({
            name: `${config.metrics.core.prefix}realtime_rooms`, 
            help: 'Number of rooms', 
            registers: [this.registries.core] 
          }),
          subscriptions: new Gauge({
            name: `${config.metrics.core.prefix}realtime_subscriptions`,
            help: 'Number of subscriptions', 
            registers: [this.registries.core] 
          }),
        },
      },
    };

    if (config.metrics.core.monitorRequestDuration) {
      // Need to be registered in a separate registry to avoid
      // the core registry resetting in updateCoreMetrics
      this.registries.requestDuration = new Registry();
      this.metrics.requestDuration = new Histogram({
        name: `${config.metrics.core.prefix}api_request_duration_ms`,
        help: 'Duration of Kuzzle requests in ms',
        labelNames: ['action', 'controller', 'protocol', 'status'],
        registers: [this.registries.requestDuration],
        buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]
      });
    }

    if (config.metrics.default.enabled) {
      this.registries.default = new Registry();
      collectDefaultMetrics({
        register: this.registries.default,
        prefix: config.metrics.default.prefix,
        eventLoopMonitoringPrecision: config.metrics.default.eventLoopMonitoringPrecision,
        gcDurationBuckets: config.metrics.default.gcDurationBuckets,
      });
    }
  }

  /**
   * Update the Prometheus coreMetrics with from the server:metrics JSON response
   * @param {JSONObject} jsonMetrics - The server:metrics JSON response
   */
  public updateCoreMetrics (jsonMetrics: JSONObject): void {
    // Past metrics are oudated, so we need to reset them
    this.registries.core.resetMetrics();

    for (const component of Object.keys(jsonMetrics)) {
      for (const metric of Object.keys(jsonMetrics[component])) {
        if (typeof this.metrics.core[component][metric] === 'undefined') {
          continue;
        }

        if (typeof jsonMetrics[component][metric] === 'number') {
          this.metrics.core[component][metric].set(jsonMetrics[component][metric]);
        }

        // Only for network.connections metric since we label it using protocol name
        if (typeof jsonMetrics[component][metric] === 'object') {
          for (const protocol of Object.keys(jsonMetrics[component][metric])) {
            this.metrics.core[component][metric].set({ protocol }, jsonMetrics[component][metric][protocol]);
          }
        }
      }
    }
  }

  /**
   * Merge all the Prometheus registries into one and returns metrics as Prometheus text format
   * @returns {string} All the regitries metrics formatted as a Prometheus text
   */
  public getMetrics (): Promise<string> {
    return Registry.merge(Object.values(this.registries)).metrics();
  }

  /**
   * Returns the content type used to export metrics to Prometheus
   * @returns {string} The content type used to export metrics to Prometheus
   */
  public getPrometheusContentType (): string {
    return this.registries.core.contentType;
  }

  /**
   * Record response time in the Prometheus responseTime histogram
   * @param {number}                            time    - Time in ms
   * @param {{[key: string]: string | number}}  labels  - Labels to add to the metric
   */
  public recordResponseTime (time: number, labels: {[key: string]: string | number}): void {
    this.metrics.requestDuration.labels(labels).observe(time);
  }
}
