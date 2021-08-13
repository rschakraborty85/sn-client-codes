// wsdReservationService - service
// custom type definitions can be found at the bottom of the file.

function wsdReservationService($http, wsdUtils) {
  var RESERVATION_BASE_URL = "/api/sn_wsd_rsv/reservation";
  var RECURRING_BASE_URL = "/api/sn_wsd_rsv/recurring_reservation";
  var RESERVATION_ADD_URL = wsdUtils.formatString(
    "{0}/{1}",
    RESERVATION_BASE_URL,
    "add"
  );
  var RESERVATION_GET_URL = wsdUtils.formatString(
    "{0}/{1}",
    RESERVATION_BASE_URL,
    "get"
  );
  var RESERVATION_CANCEL_URL = wsdUtils.formatString(
    "{0}/{1}",
    RESERVATION_BASE_URL,
    "cancel"
  );
  var RESERVATION_UPDATE_URL = wsdUtils.formatString(
    "{0}/{1}",
    RESERVATION_BASE_URL,
    "update"
  );
  var RECURRING_SERIES_CREATE_URL = wsdUtils.formatString(
    "{0}/{1}",
    RECURRING_BASE_URL,
    "create_series"
  );

  /**
   * Create a new reservation
   * @param {ReservationRequestObj} reservation - reservation object that will be inserted
   * @returns {Promise<any>}
   */
  function createReservation(reservation) {
    return $http
      .post(RESERVATION_ADD_URL, reservation)
      .then(function success(response) {
        //console.log("RC wsdReservationService " + JSON.stringify(response));
        return response.data.result;
      });
  }

  /**
   * Creates a new recurring series
   * @param recurringReservation
   * @return {PromiseLike<any>}
   */
  function createRecurringReservation(recurringReservation) {
    return $http
      .post(RECURRING_SERIES_CREATE_URL, recurringReservation)
      .then(_getResultFromResponse);
  }

  /**
   * update a existing reservation
   * @param {string} reservationId - id of the reservation to update
   * @param {ReservationRequestObj} reservation - reservation object that will be used to update
   * @returns {Promise<any>}
   */
  function updateReservation(reservationId, reservation) {
    var url = wsdUtils.formatString(
      "{0}/{1}",
      RESERVATION_UPDATE_URL,
      reservationId
    );
    return $http.patch(url, reservation).then(_getResultFromResponse);
  }

  /**
   * Get an existing reservation
   * @param {string} reservationId - sys_id of the reservation
   * @param {Object.<string, GetReservationQueryParams>} config - object containing query params
   * @returns {Promise<{reservation: ReservationResponseObj}|any>}
   */
  function getReservation(reservationId, config) {
    var url = wsdUtils.formatString(
      "{0}/{1}",
      RESERVATION_GET_URL,
      reservationId
    );
    return $http.get(url, config).then(_getResultFromResponse);
  }

  /**
   * Cancel an existing reservation
   * @param {string} reservationId - sys_id of the reservation
   * @param {CancelRequestBody} body - request body with additional data, e.g., cancel notes and last updated sub source
   * @returns {Promise<any>}
   */
  function cancelReservation(reservationId, body) {
    var url = wsdUtils.formatString(
      "{0}/{1}",
      RESERVATION_CANCEL_URL,
      reservationId
    );
    return $http.patch(url, body).then(_getResultFromResponse);
  }

  /**
   * parses result from call to api
   * @param {$http_request} response
   * @return {*}
   * @private
   */
  function _getResultFromResponse(response) {
    return response.data.result;
  }

  return {
    createRecurringReservation: createRecurringReservation,
    createReservation: createReservation,
    updateReservation: updateReservation,
    getReservation: getReservation,
    cancelReservation: cancelReservation,
  };

  /**
   * @typedef ReservationRequestObj
   * @property {string} location
   * @property {string} subject
   * @property {string} type
   * @property {Moment} start
   * @property {Moment} end
   * @property {number} attendees
   * @property {Object} on_behalf_of
   * @property {Object} opened_by
   */

  /**
   * @typedef ReservationResponseObj
   * @property {string} sys_id
   * @property {string} number
   * @property {string} subject
   * @property {string} attendees
   * @property {string} start
   * @property {string} end
   * @property {string} sys_created_on
   * @property {string} sys_updated_on
   * @property {number} capacity
   * @property {number} number_of_attendees
   * @property {boolean} is_parent
   * @property {User} requested_for
   * @property {ChoiceField} state
   * @property {ChoiceField} reservation_type
   * @property {ChoiceField} reservation_subtype
   * @property {ChoiceField} reservation_purpose
   * @property {ReferenceField} location
   * @property {ReferenceField || null} region
   * @property {ReferenceField || null} site
   * @property {ReferenceField || null} campus
   * @property {ReferenceField || null} building
   * @property {ReferenceField || null} floor
   * @property {ReferenceField || null} area
   */

  /**
   * Request body for cancel operation
   * @typedef CancelRequestBody
   * @property {string} cancel_notes
   * @property {string} last_updated_sub_source
   */

  /**
   * @typedef ReferenceField
   * @property {string} display_value
   * @property {string} sys_id
   */

  /**
   * @typedef User
   * @property {string} sys_id
   * @property {string} name
   * @property {string} user_name
   */

  /**
   * @typedef ChoiceField
   * @property {string} value
   * @property {string} display_value
   */

  /**
   * @typedef GetReservationQueryParams
   * @property {boolean} include_standard_services
   */
}
