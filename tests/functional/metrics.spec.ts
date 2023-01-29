import { assert } from 'chai';
import fetch from 'node-fetch';
import { WebSocket } from 'ws';

const host = 'localhost:7512';

test('Fetching Prometheus formatted metrics from server:metrics with the format parameter set to "prometheus"', async () => {
  const response = await fetch(`http://${host}/_metrics?format=prometheus`, {});
  const nodeId = response.headers.get('X-Kuzzle-Node');
  const result = await response.text();
  assert(typeof result === 'string');
  assert(result.split('\n').includes(`kuzzle_network_connections{protocol="http/1.1",environment="dev",project="prometheus-plugin",nodeId="${nodeId}"} 1`));
});

test('Trying to fetch Prometheus formatted metrics from server:metrics without the format parameter', async () => {
  const response = await fetch(`http://${host}/_metrics`, {});
  const nodeId = response.headers.get('X-Kuzzle-Node');
  const result = await response.json();
  assert(typeof result === 'object');
  assert(typeof result.result.api === 'object');
  assert(result.node === nodeId);
});

test('Trying to fetch Prometheus formatted metrics from server:metrics with the format parameter set to "whatEver"', async () => {
  const response = await fetch(`http://${host}/_metrics?format=whatEver`, {});
  const nodeId = response.headers.get('X-Kuzzle-Node');
  const result = await response.json();
  assert(typeof result === 'object');
  assert(typeof result.result.api === 'object'); 
  assert(result.node === nodeId);
});

test('Trying to fetch Prometheus formatted metrics from server:metrics with the format parameter set to "prometheus" through WebSocket', async () => {
  const connection = new WebSocket(`ws://${host}`);
  let result;

  connection.onmessage = (message) => {
    result = message.data;
    connection.close();
  };
  
  connection.onopen = () => {
    connection.send(JSON.stringify({
      controller: 'server',
      action: 'metrics',
      format: 'prometheus'
    }));
  };

  while (connection.readyState !== WebSocket.CLOSED && !result) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  result = JSON.parse(result);
  assert(typeof result === 'object');
  assert(typeof result.result.api === 'object');
  assert(result.node !== undefined);
});