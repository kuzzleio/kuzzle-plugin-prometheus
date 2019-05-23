# Table of Contents

- [About](#about)
- [Plugin configuration](#plugin-configuration)
  - [Installation](#installation)
  - [General configuration](#general-configuration)
  - [Retrieving probe measures](#retrieving-probe-measures)
- [Probes description](#probes-description)
  - [`monitor` probes](#monitor-probes)
    - [Description](#description)
    - [Configuration](#configuration)
    - [Measure document](#measure-document)
  - [`counter` probes](#counter-probes)
    - [Description](#description-1)
    - [Configuration](#configuration-1)
    - [Measure document](#measure-document-1)
  - [`watcher` probes](#watcher-probes)
    - [Description](#description-2)
    - [Configuration](#configuration-2)
    - [Measure document (first probe example)](#measure-document-first-probe-example)
    - [Measure document (second probe example)](#measure-document-second-probe-example)
    - [Adding a `watcher` probe](#adding-a-watcher-probe)
  - [`sampler` probes](#sampler-probes)
    - [Description](#description-3)
    - [Configuration](#configuration-3)
    - [Measure document](#measure-document-2)


# About

A common need when using Kuzzle in production, is to have insights about it and perform analytics on events occurring during an instance's lifecycle.
A common supply for this need is to allow attaching probes to the production instance and send the events somewhere. At Kuzzle, we use Kuzzle to monitor Kuzzle.


```
+------------------------+                   +--------------------------+
|                        |                   |                          |
|   Production Kuzzle    |                   |   Kuzzle Data Collector  |
|                        |                   |                          |
|     +------------+     |                   |       +-----------+      |
|     |            |     |                   |       |           |      |
|     |  Listener  +----------------------------------> Probes   |      |
|     |            |     |                   |       |           |      |
|     +------------+     |                   |       +-----------+      |
|                        |                   |                          |
+------------------------+                   +--------------------------+
```

This plugin (the "Probes" plugin in the image) transforms a Kuzzle instance into a Kuzzle Data Collector, which is the one that receives the events from the listeners installed on the Kuzzle instance in production.

The "Listener" plugin listens to events raised by the hooks specified in its configuration.

Both the "Probes" and the "Listener" plugins, can share the same configuration file (which can be hosted on a common repo). Fields specific to one plugin are ignored by the other.

This repo includes a docker-compose file allowing to launch a monitored Kuzzle stack along with the corresponding KDC.

# Plugin configuration

## Installation

Place the plugin directory under `plugins/available`, then create a symbolic link pointing to it under `plugins/enabled`.  
The plugin will be loaded by Kuzzle the next time it restarts.

## General configuration

After a fresh installation, the plugin configuration looks like this:

```json
{
  "activated": true,
  "config":
   {
     "storageIndex": "measures",
     "probes": {}
   }
}
```

You may need to configure the following parameters:

* `storageIndex`: the index name under which the measures will be stored

## Retrieving probe measures

The index used is the one configured under the `storageIndex` configuration parameter.

Each probe creates a new collection, using the probe name as the collection name, and stores its measurements in it.

The Listener plugin notifies the Probes each time one of the specified hooks is triggered. The Probes plugin, on the other side, is in charge of sampling these events and aggregating them in _measures_.

Measures are generally defined by an `interval`, which defines the pace at which the KDC writes a value into the storage layer.

Each time a measure is saved in the persistence layer, a custom event is triggered with the name `saveMeasure` (thus resulting in `plugin-<plugin-name>:saveMeasure`) and the measure object as the payload.

# Probes description

## `monitor` probes

### Description

`monitor` probes are basic event counters, used to monitor Kuzzle activity.

Each measure is independent from each other, meaning each counter is reset at the start of a new measurement.

Can be set on any [Kuzzle event](http://kuzzle.io/guide/#how-to-create-a-plugin). Each monitored event must be explicitly listed in the probe configuration.

### Configuration

Probe configuration example:

```json
{
  "probes": {
    "probe_monitor_1": {
      "type": "monitor",
      "hooks": ["some:event", "some:otherevent", "andyet:anotherone"],
      "interval": "10 minutes"
    }
  }
}
```

Parameters rundown:

- `probe_monitor_1` is the probe unique name, and also the data collection in which the measurements are stored
- `type: monitor` tells the plugin that this probe is a monitor one
- `hooks` lists the events to listen
- `interval` configures the measurement save interval. The following formats are accepted:
  - `"none"`: no interval, each listened event will create a new measure document
  - `"duration"`: a string in human readable format, using the [ms conversion library](https://www.npmjs.com/package/ms)

### Measure document

Following the previously given example: every 10 minutes, a new measure will be written with the counted fired events.

The measure document will look like this:

```json
{
  "some:event": 142,
  "some:otherevent": 0,
  "andyet:anotherone": 3,
  "timestamp": 123456789
}
```

The `timestamp` field is automatically added, and marks the end of a measurement. It's encoded as the number of milliseconds since Epoch.

## `counter` probes

### Description

`counter` probes aggregate multiple fired events into a single measurement counter.  

Each measure is cumulative, meaning counters are kept for the entire Kuzzle uptime, without ever being reset.

The counter can be increased by some events, and decreased by others.

Can be set on any Kuzzle event. Each monitored event must be explicitly listed in the probe configuration.

### Configuration

Probe configuration example:

```json
{
  "probes": {
    "probe_counter_1": {
      "type": "counter",
      "increasers": ["list:of", "counterIncreasing:events"],
      "decreasers": ["anotherlist:of", "counterDecreasing:events"],
      "interval": "1h"
    }
  }
}
```

Parameters rundown:

- `probe_counter_1` is the probe unique name, and also the data collection in which the measurements are stored
- `type: counter` tells the plugin that this probe is a counter one
- `increasers` lists the events increasing the counter
- `decreasers` lists the events decreasing the counter
- `interval` configures the measurement save interval. The following formats are accepted:
  - `"none"`: no interval, each listened event will create a new measure document
  - `"duration"`: a string in human readable format, using the [ms conversion library](https://www.npmjs.com/package/ms)

### Measure document

Following the previously given example: every 1 hour, a new measure will be written with the counted fired events.

The measure document will look like this:

```json
{
  "count": 1234,
  "timestamp": 123456789
}
```

The `timestamp` field is automatically added, and marks the end of a measurement. It's encoded as the number of milliseconds since Epoch.

## `watcher` probes

### Description

`watcher` probes watch documents and messages activity, counting them or retrieving part of their content.  
Filters can be added to focus on particular documents and/or messages, and a probe can only monitor one index-collection pair at a time

Each measure is independent from each other, meaning each watcher probe is reset at the start of a new measurement.

:warning: Current limitation: due to the way Kuzzle handles documents, only newly created documents can be watched with a `create` or a `createOrReplace` action. This will be fixed in the future.

### Configuration

Probe configuration examples:

```json
{
  "probes": {
    "probe_watcher_1": {
      "type": "watcher",
      "index": "some index",
      "collection": "some collection",
      "filter": {},
      "collects": [
        "documentField",
        "a.nestedAttribute.using.JsonPath"
      ],
      "mapping": {
        "_id": {"type": "string"},
        "documentField": {"type": "string", "index": "not_analyzed"},
        "a": {
          "properties": {
            "nestedAttribute": {
              "properties": {
                "using": {
                  "properties" : {
                    "JsonPath": {"type": "string"}
                  }
                }
              }
            }
          }
        }
      },
      "interval": "10 minutes"
    },
    "probe_watcher_2": {
      "type": "watcher",
      "index": "some index",
      "collection": "some collection",
      "filter": {
        "term": {
          "uses": "KuzzleDSL"
        }
      },
      "interval": "1h"
    }
  }
}
```

Parameters rundown:

- `probe_watcher_1` and `probe_watcher_2` are the probe unique names, and also the data collections in which the measurements are stored
- `type: watcher` tells the plugin that these probes are watcher probes
- `interval` configures the measurement save interval. The following formats are accepted:
  - `"none"`: no interval, each listened event will create a new measure document
  - `"duration"`: a string in human readable format, using the [ms conversion library](https://www.npmjs.com/package/ms)
- `collects` tells the probe which parts of the matched documents/messages to collect. This parameter can be:
  - empty, null or undefined: no data will be collected, only the number of matched documents/messages will be reported
  - a wildcard (`*`): the entire document/message will be collected         
  - an array listing the document/message attributes to collect, as JSON paths
- `filter` configures what documents/messages will be watched:
  - if empty, undefined or null, all documents/messages sent to the corresponding index-collection pair will be collected
  - otherwise, a filter can be set, using [Kuzzle DSL](http://kuzzle.io/guide/#filtering-syntax)
- `mapping` configures the mapping of collected fields in the probe's measurement collection:
  - empty, null or undefined: lets Elasticsearch choose a default mapping for collected fields (not recommended)
  - a valid [Elasticsearch mapping](https://www.elastic.co/guide/en/elasticsearch/reference/2.3/mapping.html) for the field content: applies the mapping to the non-existing collection
    - the mapping will not apply if the collection already exists
    - the mapping will not apply if `collects` is empty
    - :warning: no check is done between `collects` fields and the provided mapping

### Measure document (first probe example)

The probe `probe_watcher_1` will act like this: every 10 minutes, all documents and messages sent to index `some index` and collection `some data collection` will be saved (there is no filter set).

There will be 1 document written per document/message collected, and these written documents will contain:
- the measurement timestamp
- the configured attributes to collect (in the example, only 2 attributes will be collected)
- if provided, the document unique identifier

The measure document will look like this:

```json
{
  "content": {
    "_id": "will only appear if provided",
    "documentField": "collected 'documentField' value",
    "a": {
      "nestedAttribute": {
        "using": {
          "JsonPath": "collected value"
        }
      }
    }
  },
  "timestamp": 123456789
}
```

The `timestamp` field is automatically added, and mark the end of a measurement. It's encoded as the number of milliseconds since Epoch.

### Measure document (second probe example)

The probe `probe_watcher_2` will act like this: it watches documents and messages sent to index `some index` and collection `some data collection`. If, and only if, a document/message matches the provided filter, then the probe will increment a document counter (there is no attribute to collect).

Then, every 1 hour, a new measure document will be written, looking like this:

```json
{
  "count": 1234,
  "timestamp": 123456789
}
```

The `timestamp` field is automatically added, and mark the end of a measurement. It's encoded as the number of milliseconds since Epoch.

## `sampler` probes

### Description

Sampler probes are similar to [watcher probes](#watcher-probes), but instead of collecting every document/message matching the configured probe, they retrieve only a statistical sample of documents/messages.  
The sampler probe guarantees a statistically evenly distributed sample, meaning all documents and messages have the same probability to enter the sample.  

The "sampleSize", "collects" and "interval" parameters are required.  
The sample size should be large enough and the duration long enough for the sample to have meaning statistically speaking.

Filters can be added to focus on particular documents and/or messages, and a probe can only monitor one index-collection pair at a time

Each measure is independent from each other, meaning each watcher probe is reset at the start of a new measurement.

:warning: Current limitation: due to the way Kuzzle handle documents, only newly created documents can be watched with a `create` or a `createOrReplace` action. This will be fixed in the future.

### Configuration

Probe configuration examples:

```json
{
  "probes": {
    "probe_sampler": {
      "type": "sampler",
      "index": "some index",
      "collection": "some collection",
      "sampleSize": 1234,
      "filter": {},
      "collects": [
        "documentField",
        "a.nestedAttribute.using.JsonPath"
      ],
      "interval": "1 hour"
    }
  }
}
```

Parameters rundown:

- `probe_sampler` is the probe unique name, and also the data collection in which the measurements are stored
- `type: sampler` tells the plugin that these probes are sampler probes
- `sampleSize` is the size of each document/message sample
- `interval` configures the measurement save interval. It must be set with a "duration": a string in human readable format, using the [ms conversion library](https://www.npmjs.com/package/ms)
- `collects` configures the probe to collect document/message data. This parameter can be:                        
  - a wildcard (`*`): the entire document/message will be collected         
  - an array listing the document/message attributes to collect, as JSON paths
- `filter` configures what documents/messages will be watched:
  - if empty, undefined or null, all documents/messages sent to the corresponding index-collection pair will be collected
  - otherwise, a filter can be set, using [Kuzzle DSL](http://kuzzle.io/guide/#filtering-syntax)

### Measure document

The probe `probe_sampler` will act like this: all documents and messages sent to index `some index` and collection `some data collection` are examined. If, and only if, a document/message matches the provided filter, then the probe will calculate a probability for it to enter the current sample.

Every 1 hour, all sampled documents and messages will be saved in the database.  
There will be 1 document written per document/message collected, and these written documents will contain:
- the measurement timestamp
- the configured attributes to collect (in the example, only 2 attributes will be collected)
- if provided, the document unique identifier

The measure document will look like this:

```json
{
  "content": {
    "_id": "will only appear if provided",
    "documentField": "collected 'documentField' value",
    "a": {
      "nestedAttribute": {
        "using": {
          "JsonPath": "collected value"
        }
      }
    }
  },
  "timestamp": 123456789
}
```

The `timestamp` field is automatically added, and mark the end of a measurement. It's encoded as the number of milliseconds since Epoch.
