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

const os = require('os'),
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
 * @property {String}                  key            Key used when pushing Prometheus Registry to Redis
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
      syncInterval: 7500,
      systemMetricsInterval: 5000
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
  }

  /**
   * Plugin initialisation
   *
   * @param {Object}              config   Plugin configuration from kuzzlerc file
   * @param {KuzzlePluginContext} context
   */
  async init(config, context) {
    this.config = { ...this.config, ...config };
    this.context = context;

    /**
     * Using MAC address to generate Kuzzle Cluster node
     * specific Redis key. This can be spoofed but
     * if this the case, falsified Prometheus metrics are
     * not your main problem.
     */
    this.hostname = os.hostname();
    this.MAC = await promisify(require('macaddress').one)();
    this.IP = getIPFromMAC(this.MAC);
    this.key = `kuzzle_prometheus_${this.hostname}_${this.nodeMAC}_${this.IP}`;

    this.registry = Prometheus.Registry.globalRegistry;
    this.registry.setDefaultLabels({
      nodeHost: this.hostname,
      nodeMAC: this.MAC,
      nodeIP: this.IP
    });

    this.kuzzleMetrics = {
      requests: new Prometheus.Histogram({
        name: `kuzzle_requests`,
        help: `Kuzzle monitoring succeeded requests`,
        buckets: Prometheus.exponentialBuckets(0.0001, 1.5, 36),
        labelNames: ['controller', 'action', 'event', 'status', 'protocol']
      }),
      rooms: new Prometheus.Gauge({
        name: `kuzzle_active_rooms`,
        help: `Kuzzle active rooms counter`
      })
    };

    this.hooks = {
      'room:new': () => this.recordRooms('room:new'),
      'room:remove': () => this.recordRooms('room:remove'),
      'request:onSuccess': this.recordRequests.bind(this),
      'request:onError': this.recordRequests.bind(this)
    };

    this.systemMetricsJob = Prometheus.collectDefaultMetrics({
      register: this.register,
      timeout: this.config.systemMetricsInterval
    });

    this.syncJob = setInterval(
      () => this.pushRegistry(),
      this.config.syncInterval
    );
  }

  /**
   * Hooks
   */

  /**
   * Record rooms creation to Prometheus Registry
   * when 'room:new' Kuzzle Event is triggered.
   *
   * @param {String} event
   */
  recordRooms(event) {
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
    if (request.input.action !== 'metrics') {
      this.kuzzleMetrics.requests.observe(
        {
          controller: request.input.controller,
          action: request.input.action,
          event,
          protocol: request.context.connection.protocol
        },
        Date.now() - request.timestamp
      );
    }
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
    const register = await this.syncRegisters();
    request.response.setHeader('Content-Type', register.contentType);
    request.response.raw = true;
    return register.metrics();
  }

  /**
   * Helpers
   */

  /**
   * Push given Prometheus registers as string
   * to Redis using the provided key
   */
  async pushRegistry() {
    await this.context.accessors.sdk.ms.set(
      this.key,
      JSON.stringify(this.registry.getMetricsAsJSON())
    );
  }

  /**
   * Pull Prometheus registers stored in Redis merge them
   * with the local one and return a new Registry which
   * contains all Prometheus metrics
   *
   * @return {Prometheus.Registry}
   */
  async syncRegisters() {
    let cursor = 0,
      values = [];

    do {
      let result = await this.context.accessors.sdk.ms.scan(cursor, {
        match: 'kuzzle_prometheus_*'
      });

      cursor = parseInt(result.cursor);
      values = values.concat(result.values);
    } while (cursor !== 0);

    const keys = values.filter(k => k !== this.key);
    const remoteRegisters =
      keys.length !== 0
        ? (await this.context.accessors.sdk.ms.mget(keys)).map(r =>
            JSON.parse(r)
          )
        : [];
    return Prometheus.AggregatorRegistry.aggregate(
      remoteRegisters.concat([this.registry.getMetricsAsJSON()])
    );
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
