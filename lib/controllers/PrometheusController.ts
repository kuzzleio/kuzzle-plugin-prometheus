import {
  ControllerDefinition,
  PluginContext,
  KuzzleRequest,
  JSONObject,
  PluginImplementationError,
} from 'kuzzle';

import os from 'os';
import Prometheus from 'prom-client';
import util from 'util';
import macaddress from 'macaddress';

const getIPFromMAC = mac => {
  const interfaces : NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces();
  for (const inet of Object.keys(interfaces)) {
    for (const settings of interfaces[inet]) {
      if (settings.mac === mac) {
        return settings.address;
      }
    }
  }
};

export class PrometheusController {
  private context: PluginContext;
  private config: JSONObject;

  private _mac? : string;
  private _ip? : string;
  private _hostname? : string;
  private _registry? : Prometheus.Registry;
  private _kuzzleMetrics? : JSONObject;
  private _systemMetricsJob? : any;

  public definition: ControllerDefinition;
  public hooks: JSONObject;

  /**
   * PrometheusController constructor
   * @param config
   * @param context
   */
  constructor (config: JSONObject, context: PluginContext) {
    this.config = config;
    this.context = context;

    this.definition = {
      actions: {
        metrics: {
          handler: this.metrics.bind(this),
        }
      }
    };
  }

  async init () {
    this._hostname = os.hostname();

    this._mac = <string> await util.promisify(macaddress.one)();
    this._ip = getIPFromMAC(this._mac);
    this._registry = Prometheus.register;

    if (!Array.isArray(this.config.labels.common)) {
      throw new Error(`[prometheus plugin] Configuration error: Expected 'labels.common' to be an array, ${typeof this.config.labels.common} received.`);
    }

    // default labels
    const labels = {};
    for (const label of this.config.labels.common) {
      switch (label) {
        case 'nodeHost':
          labels[label] = this._hostname;
          break;
        case 'nodeMAC':
          labels[label] = this._mac;
          break;
        case 'nodeIP':
          labels[label] = this._ip;
          break;
        default:
          throw new Error(`[prometheus plugin] Configuration error: Invalid common label ${label}, should be one of [nodeHost, nodeMAC, nodeIP]`);
      }
    }

    if (this.config.labels.common.length > 0) {
      this._registry.setDefaultLabels(labels);
    }

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

    this._kuzzleMetrics = {
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
      subscriptions: new Prometheus.Gauge({
        name: `kuzzle_active_subscriptions`,
        help: `Kuzzle active subscriptions counter`
      }),
      connections: new Prometheus.Gauge({
        name: `kuzzle_active_connections`,
        help: `Kuzzle active connections counter`
      }),
    };

    if (this.config.collectSystemMetrics) {
      this._systemMetricsJob = Prometheus.collectDefaultMetrics({
        register: this._registry,
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
  recordConnections (action: 'inc' | 'dec') {
    this.updateGauge('connections', action);
  }

  /**
   * Record active rooms to Prometheus Registry
   *
   * @param {String} event
   */
  recordRooms (action: 'inc' | 'dec') {
    this.updateGauge('rooms', action);
  }

  /**
   * Record active subscriptions to Prometheus Registry
   *
   * @param {String} event
   */
  recordSubscriptions (action: 'inc' | 'dec') {
    this.updateGauge('subscriptions', action);
  }

  /**
   * Record requests information to Prometheus Registry.
   *
   * @param {Request} request
   * @param {String}  event
   */
  recordRequests (request: KuzzleRequest, event: string) {
    if (request.input.controller === 'prometheus'
      && request.input.action === 'metrics'
    ) {
      return;
    }

    const data: JSONObject = {};
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

    this._kuzzleMetrics.requests.observe(
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
  async metrics (request: KuzzleRequest) : Promise<string> {
    if (request.context.connection.protocol === 'http') {
      request.response.configure({
        headers: {
          'Content-Type': this._registry.contentType
        }
      });
      request.response.raw = true;
      return this._registry.metrics();
    }
  }

  private updateGauge (name: string, action: 'inc' | 'dec') {
    if (! this._kuzzleMetrics[name]) {
      throw new PluginImplementationError(`"${name}" is not a valid gauge`);
    }

    if (action === 'inc') {
      this._kuzzleMetrics[name].inc();
    }
    else {
      this._kuzzleMetrics[name].dec();
    }
  }
}
