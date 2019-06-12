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

// One-liner promisify helper
const promisify = f => (...args) =>
  new Promise((a, b) => f(...args, (e, r) => (e ? b(e) : a(r))));

/**
 * @class PrometheusPlugin
 *
 * @property {KuzzlePluginContext}     context
 * @property {Controllers}             controllers
 * @property {Object.<string, string>} hooks
 * @property {Routes}                  routes
 * @property {String}                  jobName
 * @property {Prometheus.Pushgateway}  gateway
 * @property {Object.<string, Object}  metrics
 *
 * @externs
 */
class PrometheusPlugin {
  constructor() {
    this.context = null;
    this.config = {};
    this.hooks = {};
    this.metrics = {};
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

    this.jobName = this.config.pushGateway.jobName;
    this.gateway = new Prometheus.Pushgateway(this.config.pushGateway.host);

    // Override push method with a promisified version
    this.gateway.push = promisify(this.gateway.push.bind(this.gateway));

    /* Initialize Prometheus metrics */
    if (this.config.monitoring.request.length !== 0) {
      this.metrics.request = new Prometheus.Histogram({
        name: `kuzzle_request`,
        help: `Kuzzle requests monitoring (count and latency)`,
        buckets: Prometheus.exponentialBuckets(0.0001, 1.5, 36),
        labelNames: ['controller', 'action', 'event', 'status']
      });

      for (const event of this.config.monitoring.request) {
        this.hooks[event] = this.requestInfo.bind(this);
      }
    }
  }

  /**
   * Record request information in Prometheus histogram
   * when associated hooks are triggered
   *
   * @param {Request} request
   * @param {String}  event
   */
  async requestInfo(request, event) {
    this.metrics.request.observe(
      {
        controller: request.input.controller,
        action: request.input.action,
        status: request.status,
        event
      },
      Date.now() - request.timestamp
    );

    try {
      await this.gateway.push({
        jobName: this.jobName
      });
    } catch (e) {
      this.context.log.error(e);
    }
  }
}

module.exports = PrometheusPlugin;
