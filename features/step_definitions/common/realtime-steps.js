'use strict';
const { Then } = require('cucumber');

Then('I subscribe to {string}:{string} notifications', async function (index, collection) {
  if (! this.props.subscriptions) {
    this.props.subscriptions = {};
  }

  const roomId = await this.sdk.realtime.subscribe(
    index,
    collection,
    {},
    notification => {
      this.props.subscriptions[`${index}:${collection}`].notifications.push(notification);
    });

  this.props.subscriptions[`${index}:${collection}`] = {
    unsubscribe: () => this.sdk.realtime.unsubscribe(roomId),
    notifications: []
  };
});