Feature: Prometheus metrics fetching
  Scenario: Fetching Prometheus formatted metrics from server:metrics
    When I successfully execute the action "server":"metrics" with args:
      | format   | "prometheus" |
   Then I debug "result"
