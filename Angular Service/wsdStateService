// custom type definitions can be found at the bottom of the file.

function wsdStateService($rootScope, $location) {
  var WSD_BROADCAST_PREFIX = "wsd_reservation_";
  var state = {};
  var subscriptions = {};

  this.setState = setState;

  /**
   * clean and reset all states, deregister all subscription. Used on destroy functions.
   */
  this.reset = function () {
    // remove all states;
    state = {};

    // deregister all subscribers
    for (var subKey in subscriptions) {
      subscriptions[subKey].forEach(function (deregister) {
        deregister();
      });
    }

    subscriptions = {};
  };

  /**
   * With this function multiple values can be set at once, and those values will be added to the url
   * where the key in the object will be the queryParam name
   * It will notify separately for each key in the object
   * @param {Object.<string, string>} data - key value pairs dat will be set as page state
   */
  this.setPageStates = function (data) {
    Object.keys(data).forEach(function (key) {
      var oldValue = data[key];
      var value = data[key];
      state[key] = value;
      notifySubscribers(key, oldValue, value);
    });
    _setUrlState(data);
  };

  /**
   * sets a larger object to page state, where the individual keys are also set into the url
   * @param {string} key
   * @param {Object.<string, string>} data - key value pairs dat will be set as page state
   * @param {boolean} [skipReload] - when true, location object will add spa=1 to indicate single page app without reloading
   * @return {Object.<string, string>} returns object containing data set in the url
   */
  this.setPageState = function (key, data, skipReload) {
    setState(key, data);
    return _setUrlState(data, skipReload);
  };

  /**
   * Remove a value and remove all subscribers
   * @param {string} key
   */
  this.unsetState = function (key) {
    var name = WSD_BROADCAST_PREFIX + key;
    delete state[name];

    if (subscriptions[name]) {
      // deregister all angular listeners for a specific name
      subscriptions[name].forEach(function (deregister) {
        deregister();
      });
    }
  };

  /**
   * Will return the full state object or the state of a specific value in the object
   * @param {string} [key]
   * @returns {{}|*}
   */
  this.getState = function (key) {
    var name = WSD_BROADCAST_PREFIX + key;
    if (key) return state[name];

    return state;
  };

  /**
   * Adds a subscriber to a value in the state that will be notified on change
   * @param {string} key
   * @param {stateNotifier} callback
   * @returns {unsubscribe}
   */
  this.subscribe = function (key, callback) {
    var name = WSD_BROADCAST_PREFIX + key;
    var deregister = $rootScope.$on(name, function (evt, oldValue, newValue) {
      callback(oldValue, newValue, event);
    });
    subscriptions[name] = subscriptions[name] ? subscriptions[name] : [];
    subscriptions[name].push(deregister);

    return deregister;
  };

  /**
   * Load certain query params into the state based on the passed in fields
   * @param {string[]} fields
   */
  this.loadUrlState = function (fields) {
    var queryParams = $location.search();
    fields.forEach(function (key) {
      if (queryParams.hasOwnProperty(key)) setState(key, queryParams[key]);
    });
  };

  /**
   * Similar to set page state, but instead of also setting values to the url, it wil set them and notify the named subscriber
   * @param {string} key - name of object in state, will also trigger subscriptions for that key
   * @param {string[]} fields - list of queryParams that should be loaded into the state
   */
  this.loadUrlStateWithName = function (key, fields) {
    var result = {};
    var queryParams = $location.search();

    fields.forEach(function (key) {
      if (queryParams.hasOwnProperty(key)) result[key] = queryParams[key];
    });

    setState(key, result);
  };

  /**
   * This will set the state of something on the stateService, and trigger subscriptions to that variable if not silent
   * @param {string} key
   * @param {*} value
   * @param {boolean} [silent]
   */
  function setState(key, value, silent) {
    var name = WSD_BROADCAST_PREFIX + key;
    var oldValue = state[name];
    state[name] = value;

    if (!silent) notifySubscribers(name, oldValue, value);
  }

  /**
   * sets the values in the provided object into the url
   * @param {Object.<string, string|number|boolean>} data - key value pairs dat will be set as page state
   * @param {boolean} skipReload - when true, location object will add spa=1 to indicate single page app without reloading
   * @return {Object.<string, string>} returns object containing data set in the url
   * @private
   */
  function _setUrlState(data, skipReload) {
    var oldQueryParam = $location.search();
    var newQueryParam = _.merge(oldQueryParam, data);

    if (skipReload) {
      newQueryParam["spa"] = 1; // signals service-portal to not refresh even if url changes
    }

    // Else, update location.search so portal doesn't refresh
    $location.search(newQueryParam);
    return $location.search();
  }

  /**
   * Executes all the subscribers for a specific value
   * @param {string} key
   * @param {*} oldValue
   * @param {*} newValue
   */
  function notifySubscribers(key, oldValue, newValue) {
    $rootScope.$broadcast(key, oldValue, newValue);
  }

  /**
   * @callback stateNotifier
   * @param {*} oldValue
   * @param {*} newValue
   * @param {$event} event - angular broadcast event
   */

  /**
   * void method that removes a subscriber from so I wont get triggered on changes anymore.
   * @callback unsubscribe
   */
}
