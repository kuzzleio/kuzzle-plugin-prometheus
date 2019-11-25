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
'use strict';

const
  os = require('os'),
  Prometheus = require('prom-client');

/**
 * @class PrometheusPlugin
 *
 * @property {KuzzlePluginContext}     context        Kuzzle plugin context
 * @property {Object.<string, string>} hooks          Kuzzle plugin hooks
 * @property {Routes}                  routes         Kuzzle plugin routes
 * @property {Controllers}             controllers    Kuzzle plugin controllers
 * @property {Prometheus.Registry}     registry       Prometheus Registry
 * @property {Object.<string, Object>} kuzzleMetrics  Prometheus metrics dedicated for Kuzzle
 * @property {String}                  hostname       Hostname
 * @property {String}                  MAC            Host MAC address
 * @property {String}                  IP             Host IPv4 adress
 *
 * @externs
 */
class PrometheusPlugin {
  /**
   * PrometheusPlugin constructor
   *
   * @returns {PrometheusPlugin}
   */
  constructor() {
    this.config = {
      collectSystemMetrics: true,
      systemMetricsInterval: 5000,
      labels: {
        common: [
          'nodeHost',
          'nodeMAC',
          'nodeIP'
        ],
        kuzzle: [
          'controller',
          'action',
          'event',
          'protocol',
          'status'
        ]
      }
    };

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

    this.hostname = os.hostname();

    this._mac = null;
    this._ip = null;
  }


  get MAC() {
    return this._mac;
  }

  get IP() {
    return this._ip;
  }

  /**
   * Plugin initialization
   *
   * @param {Object}              config   Plugin configuration from kuzzlerc file
   * @param {KuzzlePluginContext} context
   */
  async init(config, context) {
    Object.assign(this.config.labels, config.labels);
    delete config.labels;
    Object.assign(this.config, config);

    this.context = context;

    this._mac = await promisify(require('macaddress').one)();
    this._ip = getIPFromMAC(this.MAC);

    this.registry = Prometheus.Registry.globalRegistry;

    if (!Array.isArray(this.config.labels.common)) {
      throw new Error(`[prometheus plugin] Configuration error: Expected 'labels.common' to be an array, ${typeof this.config.labels.common} received.`);
    }

    // default labels
    const labels = {};
    for (const label of this.config.labels.common) {
      switch (label) {
        case 'nodeHost':
          labels[label] = this.hostname;
          break;
        case 'nodeMAC':
          labels[label] = this.MAC;
          break;
        case 'nodeIP':
          labels[label] = this.IP;
          break;
        default:
          throw new Error(`[prometheus plugin] Configuration error: Invalid common label ${label}, should be one of [nodeHost, nodeMAC, nodeIP]`);
      }
    }
    if (this.config.labels.common.length > 0) {
      this.registry.setDefaultLabels(labels);
    }

    // kuzzle labels checks
    if (!Array.isArray(this.config.labels.kuzzle)) {
      throw new Error(`[prometheus plugin] Configuration error: Expected 'labels.kuzzle' to be an array, ${typeof this.config.labels.kuzzle} received`);
    }
    if (this.config.labels.kuzzle.length === 0) {
      throw new Error('[prometheus plugin] Configuration error: \'labels.kuzzle\' cannot be empty.');
    }
    for (const label of this.config.labels.kuzzle) {
      if (![
        'controller',
        'action',
        'event',
        'protocol',
        'status'
      ].includes(label)) {
        throw new Error(`[prometheus plugin] Configuration error: Invalid kuzzle label ${label}, should be one of [controller, action, event, protocol, status]`);
      }
    }

    this.kuzzleMetrics = {
      requests: new Prometheus.Histogram({
        name: `kuzzle_requests`,
        help: `Kuzzle monitoring succeeded requests`,
        buckets: Prometheus.exponentialBuckets(0.0001, 1.5, 36),
        labelNames: this.config.labels.kuzzle
      }),
      rooms: new Prometheus.Gauge({
        name: `kuzzle_active_rooms`,
        help: `Kuzzle active rooms counter`
      }),
      connections: new Prometheus.Gauge({
        name: `kuzzle_active_connections`,
        help: `Kuzzle active connections counter`
      })
    };

    this.hooks = {
      'connection:new': this.recordConnections.bind(this),
      'connection:remove': this.recordConnections.bind(this),
      'room:new': this.recordRooms.bind(this),
      'room:remove': this.recordRooms.bind(this),
      'request:onSuccess': this.recordRequests.bind(this),
      'request:onError': this.recordRequests.bind(this)
    };

    if (this.config.collectSystemMetrics) {
      this.systemMetricsJob = Prometheus.collectDefaultMetrics({
        register: this.register,
        timeout: this.config.systemMetricsInterval
      });
    }
  }

  /**
   * Hooks
   */

  /**
   * Record connections appending to Prometheus Registry
   * when 'connection:new' Kuzzle Event is triggered.
   *
   * @param {String} event
   */
  recordConnections(_, event) {
    switch (event) {
      case 'connection:new':
        this.kuzzleMetrics.connections.inc();
        break;
      case 'connection:remove':
        this.kuzzleMetrics.connections.dec();
        break;
    }
  }

  /**
   * Record rooms creation to Prometheus Registry
   * when 'room:new' Kuzzle Event is triggered.
   *
   * @param {String} event
   */
  recordRooms(_, event) {
    switch (event) {
      case 'room:new':
        this.kuzzleMetrics.rooms.inc();
        break;
      case 'room:remove':
        this.kuzzleMetrics.rooms.dec();
        break;
    }
  }

  /**
   * Record requests information to Prometheus Registry.
   *
   * @param {Request} request
   * @param {String}  event
   */
  recordRequests(request, event) {
    if ( request.input.controller === 'kuzzle-plugin-prometheus/prometheus'
      && request.input.action === 'metrics'
    ) {
      return;
    }

    const data = {};
    for (const label of this.config.labels.kuzzle) {
      switch (label) {
        case 'controller':
          data.controller = request.input.controller;
          break;
        case 'action':
          data.action = request.input.action;
          break;
        case 'event':
          data.event = event;
          break;
        case 'protocol':
          data.protocol = request.context.connection.protocol;
          break;
        case 'status':
          data.status = request.status;
          break;
      }
    }

    this.kuzzleMetrics.requests.observe(
      data,
      Date.now() - request.timestamp
    );
  }

  /**
   * Route
   */

  /**
   * Custom route to fetch all saved metrics
   * in Prometheus metrics format
   *
   * @param {Request} request
   */
  async metrics(request) {
    if (request.context.connection.protocol === 'http') {
      const register = await this.syncRegisters();
      request.response.setHeader('Content-Type', register.contentType);
      request.response.raw = true;
      return register.metrics();
    }
  }
}

const getIPFromMAC = mac => {
  const interfaces = os.networkInterfaces();
  for (const inet in interfaces) {
    for (const settings of interfaces[inet]) {
      if (settings.mac === mac) {
        return settings.address;
      }
    }
  }
};

// Promisify as a one-liner
const promisify = f => (...p) =>
  new Promise((rs, rj) => f(...p, (e, r) => (e ? rj(e) : rs(r))));

module.exports = PrometheusPlugin;
