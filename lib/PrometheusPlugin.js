/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2019 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
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

const Prometheus = require('prom-client');

/**
 * @class PrometheusPlugin
 *
 * @property {KuzzlePluginContext}     context
 * @property {Controllers}             controllers
 * @property {Object.<string, string>} hooks
 * @property {Routes}                  routes
 * @property {Object}                  prometheusMetrics
 * @property {Prometheus.Pushgateway}  gateway
 *
 * @externs
 */
class PrometheusPlugin {
  constructor() {
    this.context = null;
    this.config = {
      /* Default configuration */
    };
    this.hooks = {
      /* Default Hooks configuration */
    };
    this.prometheusMetrics = {};
  }

  /**
   * Plugin initialisation
   *
   * @param {Object}              config
   * @param {KuzzlePluginContext} context
   */
  init(config, context) {
    this.config = { ...config };
    this.context = context;
    this.gateway = new Prometheus.Pushgateway(this.config.pushGateway.host);

    for (const event of this.config.monitoredEvents) {
      this.prometheusMetrics[event.name] = {};
      this.hooks[event.name] = [];
      for (const metric of event.metrics) {
        this.hooks[event.name].push(metric);
        this.prometheusMetrics[event.name][metric] = (() => {
          switch (metric) {
            case 'requestCount':
              return new Prometheus.Counter({
                name: `kuzzle_request_count_${event.name}`,
                help: `Kuzzle requests counter for ${event.name} Event`
              });
            case 'requestLatency':
              return new Prometheus.Summary({
                name: `kuzzle_request_duration_${event.name}`,
                help: `Duration of Kuzzle requests in ms for ${
                  event.name
                } Event`
              });
          }
        })();
      }
    }
  }

  /**
   * Add request to Prometheus counter
   * when associated hooks are triggered
   *
   * @param {Request} request
   * @param {String}  event
   */
  async requestCount(request, event) {
    this.prometheusMetrics[event]['requestCount'].inc();
    await this.pushToGateway(this.config.pushGateway.jobName);
  }

  /**
   * Record request latency in Prometheus summary
   * when associated hooks are triggered
   *
   * @param {Request} request
   * @param {String}  event
   */
  async requestLatency(request, event) {
    this.prometheusMetrics[event]['requestLatency']
      .observe(Date.now() - request.timestamp);
    await this.pushToGateway(this.config.pushGateway.jobName);
  }

  /**
   * Wrapper used to push metrics to Prometheus
   * pushgateway service
   *
   * @param   {String}  jobname
   * @returns Promise
   */
  async pushToGateway(jobName) {
    return new Promise(() => {
      this.gateway.pushAdd({ jobName }, (err) => {
        if (err) {
          Promise.reject(err);
        }
        Promise.resolve();
      });
    });
  } 
}

module.exports = PrometheusPlugin;
