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
  JSONObject
} from 'kuzzle';

import { PrometheusController } from './controllers';

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
export class PrometheusPlugin extends Plugin {
  private defaultConfig: JSONObject;
  private prometheusController : PrometheusController;

   /**
   * PrometheusPlugin constructor
   *
   * @returns {PrometheusPlugin}
   */
  constructor () {
    super({
      kuzzleVersion: '>=2.11.0 <3'
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
      'prometheus': this.prometheusController.definition
    };

    this.hooks = {
      ...this.prometheusController.hooks
    };
  }
}
