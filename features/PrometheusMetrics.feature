Feature: Prometheus metrics fetching using prometheus:metrics
  Scenario: Fetching Prometheus formatted metrics from prometheus:metrics"
    Given A running Kuzzle instance at "localhost:7512"
    When I send a HTTP request to "/_/metrics"
    Then The HTTP response should be a Prometheus formatted metrics containing:
      | kuzzle_api_concurrent_requests    | 1 |
      | process_start_time_seconds |   |
  
  Scenario: Trying to fetch Prometheus formatted metrics from prometheus:metrics through WebSocket
    Given A running Kuzzle instance at "localhost:7512"
    When I send a WebSocket request to "prometheus":"metrics" with the format parameter set to "prometheus"
    Then The WebSocket response should be a JSON object with "200" status code and a "" property
