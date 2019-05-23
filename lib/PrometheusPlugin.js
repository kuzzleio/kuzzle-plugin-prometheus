/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
 * @class KuzzlePlugin
 *
 * @property {KuzzlePluginContext} context
 * @property {Controllers} controllers
 * @property {Object.<string, string>} hooks
 * @property {Routes} routes
 *
 * @externs
 */
class PrometheusPlugin {
  constructor() {
    this.context = null;
    this.config = { /* Default configuration */ };

    this.hooks = { /* Default Hooks configuration */ };

    this.controllers = {
      prometheus: {
        metrics: 'metrics'
      }
    };

    this.routes = [
      {
        verb: 'get',
        url: '/metrics',
        controller: 'prometheus',
        action: 'metrics'
      }
    ];
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

    /**
     * Prometheus Metrics
     */

    this.requestCounter = new Prometheus.Counter({
      name: 'kuzzle_request_counter',
      help: 'Count Kuzzle requests',
      labelNames: ['type']
    });

    this.responseTimeCounter = new Prometheus.Summary({
      name: 'kuzzle_responses_duration',
      help: 'Response time in millis',
      labelNames: ['type']
    });

    /**
     * Hooks are used here as list of events we want to monitor
     */

    this.hooks = { ...this.config.monitoredEvents };
  }

  /**
   * Add request to Prometheus counter 
   * when associated hooks are triggered
   *
   * @param {Request} request
   * @param {String}  event
   */
  async requestCountHook(request, event) {
    if (request.response.action !== 'metrics') {
      switch (event) {
        case 'request:onError':
          this.requestCounter.inc({ type: 'error' });
          break;
        case 'request:onSuccess':
          this.requestCounter.inc({ type: 'success' });
          break;
        default:
      }
    }
  }

  /**
   * Record request latency in Prometheus summary 
   * when associated hooks are triggered
   *
   * @param {Request} request
   * @param {String}  event
   */
  async responseTimeHook(request, event) {
    if (request.response.action !== 'metrics') {
      switch (event) {
        case 'request:onError':
          this.responseTimeCounter
            .labels('error')
            .observe(Date.now() - request.timestamp);
          break;
        case 'request:onSuccess':
          this.responseTimeCounter
            .labels('success')
            .observe(Date.now() - request.timestamp);
          break;
        default:
      }
    }
  }

  /**
   * Custom route to fetch all saved metrics
   * in Prometheus metrics format
   *
   * @param {Request} request
   */
  async metrics(request) {
    request.response.setHeader('Content-Type', Prometheus.register.contentType);
    request.response.raw = true;
    return Prometheus.register.metrics();
  }
}

module.exports = PrometheusPlugin;
