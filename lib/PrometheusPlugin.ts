import {
  Plugin,
  PluginContext,
  JSONObject
} from 'kuzzle';

import { PrometheusController } from './controllers';

export class PrometheusPlugin extends Plugin {
  private defaultConfig: JSONObject;
  private prometheusController : PrometheusController;

  async init (config: JSONObject, context: PluginContext) {
    this.defaultConfig = {
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


    this.config = { ...this.defaultConfig, ...config };
    this.context = context;

    this.prometheusController = new PrometheusController(this.config, this.context);

    this.api = {
      'prometheus': this.prometheusController.definitions
    };

    this.hooks = {
      ...this.prometheusController.hooks
    };
  }
}