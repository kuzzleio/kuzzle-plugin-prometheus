#!/usr/bin/env bash

working_dir="/var/app"
plugin_dir="plugins/enabled/kuzzle-plugin-prometheus"


echo 'Installing dependencies'
cd "$working_dir/$plugin_dir" && npm install --unsafe-perm && cd "$working_dir"

kuzzle start