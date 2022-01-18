'use strict';

const _ = require('lodash');
const { After } = require('cucumber');

After(async function () {
  // Clean values stored by the scenario
  this.props = {};

  if (this.sdk && typeof this.sdk.disconnect === 'function') {
    this.sdk.disconnect();
  }
});

// realtime hooks ==============================================================

After({ tags: '@realtime' }, function () {
  if (_.isEmpty(this.props.subscriptions)) {
    throw new Error('@realtime time has been set but no subscriptions have been made.');
  }

  const promises = Object.values(this.props.subscriptions)
    .map(({ unsubscribe }) => unsubscribe());

  return Promise.all(promises);
});
