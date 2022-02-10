import { binding, given, then, when} from 'cucumber-tsflow';
import { assert } from 'chai';
import fetch from 'node-fetch';
import { WebSocket } from 'ws';
import _ from 'lodash';

@binding()
export class PluginSteps {
  private host: string;
  private result: any;
  private nodeId: string;

  @given(/A running Kuzzle instance at "([^"]*)"/)
  public async givenRunningKuzzleInstance(host: string) {
      const response = await fetch(`http://${host}`);
      assert(response.status === 200);
      this.nodeId = response.headers.get('X-Kuzzle-Node');
      this.host = host;
  }

  @when(/I send a HTTP request to "([^"]*)"/)
  public async whenISendARequestTo(url: string) {
    const response = await fetch(`http://${this.host}${url}`);
    this.result = response;
  }

  @when(/I send a WebSocket request to "([^"]*)":"([^"]*)" with the format parameter set to "([^"]*)"/)
  public async whenISendAWebSocketRequestToWithTheFormatParameterSetTo(controller: string, action: string, format: string) {
    const connection = new WebSocket(`ws://${this.host}`);
    this.result = undefined;

    connection.onmessage = (message) => {
      this.result = message.data;
      connection.close();
    };
    
    connection.onopen = () => {
      connection.send(JSON.stringify({
        controller,
        action,
        format
      }));
    };

    while (connection.readyState !== WebSocket.CLOSED && !this.result) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  @then(/The WebSocket response should be a JSON object with "([^"]*)" status code and a "([^"]*)" property/)
  public async thenTheResponseShouldBeAJSONObjectWithAProperty(status: string, property: string) {
    const json = JSON.parse(this.result);
    assert(json.status === parseInt(status));
    if (property !== null) {
      assert(_.get(json, property) !== undefined);
    }
  }

  @then(/The HTTP response should be a JSON object/)
  public async thenTheResponseShouldBeAJSONObject() {
    assert(this.result !== null);
    this.result = await this.result.json();
    assert(typeof this.result === 'object');
  }

  @then(/The HTTP response should be a Prometheus formatted metrics containing:/)
  public async thenTheResponseShouldContainA(table: any) {
    assert(this.result !== null);
    this.result = await this.result.text();
    assert(typeof this.result === 'string');

    const matches = table.rowsHash();
    for (const metric in matches) {
      assert(this.result.includes(`${metric}{nodeId="${this.nodeId}"}${matches[metric] !== '' ? ' ' + matches[metric] : ''}`));
    }
    assert(this.result.includes(`kuzzle_network_connections{protocol="http/1.1",nodeId="${this.nodeId}"} 1`));
  }
}