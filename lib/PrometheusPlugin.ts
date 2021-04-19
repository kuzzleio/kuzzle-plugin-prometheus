import {
  Plugin,
  PluginContext,
  JSONObject
} from 'kuzzle';

import { PrometheusController } from './controllers';

export class PrometheusPlugin extends Plugin {
  private defaultConfig: JSONObject;
  private prometheusController : PrometheusController;

  constructor () {
    super({
      kuzzleVersion: '>=2.10.2 <3'
    });

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
  }

  async init (config: JSONObject, context: PluginContext) {
    this.config = { ...this.defaultConfig, ...config };
    this.context = context;

    this.prometheusController = new PrometheusController(this.config, this.context);
    await this.prometheusController.init();

    this.api = {
      'prometheus': this.prometheusController.definitions
    };

    this.hooks = {
      ...this.prometheusController.hooks
    };
  }
}
