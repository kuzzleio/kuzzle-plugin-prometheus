import { Backend, KuzzleError } from 'kuzzle';

import { PrometheusPlugin } from '../index';

const app = new Backend('kuzzle');

const prometheusPlugin = new PrometheusPlugin();

app.plugin.use(prometheusPlugin);

app.controller.register('testing', {
  actions: {
    failure: {
      handler: async () => {
        throw new KuzzleError('A sample 500 error', 500);
      }
    }
  }
});

app.start()
  .then(() => {
    app.log.info('Application started');
  })
  .catch(console.error);
