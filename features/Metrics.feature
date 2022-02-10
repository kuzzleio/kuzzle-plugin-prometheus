Feature: Prometheus metrics fetching using server:metrics
  Scenario: Fetching Prometheus formatted metrics from server:metrics with the format parameter set to "prometheus"
    Given A running Kuzzle instance at "localhost:7512"
    When I send a HTTP request to "/_metrics?format=prometheus"
    Then The HTTP response should be a Prometheus formatted metrics containing:
      | kuzzle_api_concurrent_requests    | 1 |
      | process_start_time_seconds |   |

  Scenario: Trying to fetch Prometheus formatted metrics from server:metrics without the format parameter
    Given A running Kuzzle instance at "localhost:7512"
    When I send a HTTP request to "/_metrics"
    Then The HTTP response should be a JSON object

  Scenario: Trying to fetch Prometheus formatted metrics from server:metrics with the format parameter set to "whatEver"
    Given A running Kuzzle instance at "localhost:7512"
    When I send a HTTP request to "/_metrics?format=whatEver"
    Then The HTTP response should be a JSON object
  
  Scenario: Trying to fetch Prometheus formatted metrics from server:metrics with the format parameter set to "prometheus" through WebSocket
    Given A running Kuzzle instance at "localhost:7512"
    When I send a WebSocket request to "server":"metrics" with the format parameter set to "prometheus"
    Then The WebSocket response should be a JSON object with "200" status code and a "result.api.concurrentRequests" property
