import { Backend } from 'kuzzle';
import PluginCluster from 'kuzzle/plugins/available/kuzzle-plugin-cluster';

import { PrometheusPlugin } from '../../../index';

const app = new Backend('kuzzle');

const prometheusPlugin = new PrometheusPlugin();

app.plugin.use(prometheusPlugin);

app.start()
  .then(() => {
    app.log.info('Application started');
  })
  .catch(console.error);