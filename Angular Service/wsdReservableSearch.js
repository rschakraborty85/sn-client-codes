/** wsdReservableSearch
 * RC - changed
 * Reservable search provider - handle search execution to target Rest Api endpoints
 * custom type definitions can be found at the bottom of the file.
 * */
function wsdReservableSearch($http) {
  var RESERVABLE_SEARCH_BASE_URL = "/api/sn_wsd_rsv/search/reservable";
  var RESERVABLE_AVAILABLITY_BASE_URL = "/api/sn_wsd_rsv/search/availability";
  var RESERVABLE_MODULE_BASE_URL = "/api/sn_wsd_rsv/reservable_module/";
  var RESERVABLE_SEARCH_RESERVATION_URL =
    "/api/sn_wsd_rsv/reservation/check_existing_reservation";

  /**
   * RC - added new function
   * checks if user has existing reservation based on same request data
   * @param requestObj - has the current search param as object
   */
  function checkExistingReservation(requestObj) {
    var url = RESERVABLE_SEARCH_RESERVATION_URL;
    return $http.post(url, requestObj).then(_resultParser);
  }

  /**
   * get reservable module using sys_id
   * @param {string} sysId
   * @returns {Promise<ReservableLayoutMapping>}
   */
  function getReservableModule(sysId) {
    var url = RESERVABLE_MODULE_BASE_URL + sysId;
    return $http.get(url).then(_resultParser);
  }

  /**
   * Get a list of available reservables
   * @param {SearchRequestObject} requestObj - request object that will be used 
   * when making the REST call
   * @returns {Promise<any[]>} - a list with reservable data that is configured
   *  in the reservable module
   */
  function getAvailableReservables(requestObj) {
    var url = _constructSearchReservablesQueryStr(
      RESERVABLE_SEARCH_BASE_URL,
      requestObj
    );
    return $http.get(url).then(_resultParser);
  }

  /**
   * Check availablity for a list of given reservable at certain time
   * @param {AvailablityCheckRequestObject} requestObj
   * @return {Promise<{sys_id: string, is_available: boolean}[]>} availability result
   */
  function checkReservablesAvailabilities(requestObj) {
    var url = RESERVABLE_AVAILABLITY_BASE_URL;
    url += "?reservable_module=" + requestObj.reservable_module;
    url += "&start=" + requestObj.start;
    url += "&end=" + requestObj.end;
    url += "&reservable_ids=" + requestObj.reservable_ids;
    url += "&reservation_ids=" + requestObj.reservation_ids;
    url += "&shift=" + requestObj.shift;

    return $http.get(url).then(_resultParser);
  }

  /**
   * Construct a query string for fetching available reservables
   * @param {string} baseUrl - url of the endpoint
   * @param {SearchRequestObject} requestObj - request object that will be used when making the REST call
   * @return {string}
   * @private
   */
  function _constructSearchReservablesQueryStr(baseUrl, requestObj) {
    var url = baseUrl;
    url += "?reservable_module=" + requestObj.reservable_module;
    url += "&start=" + requestObj.start;
    url += "&end=" + requestObj.end;
    url += "&include_standard_services=" + requestObj.include_standard_services;
    url +=
      "&include_reservable_purposes=" + requestObj.include_reservable_purposes;
    url +=
      "&include_reservations_within_days=" +
      requestObj.include_reservations_within_days;
    url += "&include_unavailable_items=" + requestObj.include_unavailable_items;

    if (requestObj.next_item_index)
      url += "&next_item_index=" + requestObj.next_item_index;

    if (requestObj.mode === "edit") {
      url += "&reservation_ids=" + requestObj.reservation_ids;
      url += "&reserved_reservables=" + requestObj.reserved_reservables;
    } else if (requestObj.reserved_reservables) {
      url += "&reserved_reservables=" + requestObj.reserved_reservables;
    }

    if (requestObj.shift) url += "&shift=" + requestObj.shift;

    if (requestObj.page_size) url += "&page_size=" + requestObj.page_size;

    if (requestObj.sort_by) url += "&sort_by=" + requestObj.sort_by;

    if (requestObj.building) url += "&q=building=" + requestObj.building;

    if (requestObj.floors) url += "^floorIN" + requestObj.floors;

    if (requestObj.capacity) url += "^capacity>=" + requestObj.capacity;

    if (requestObj.standard_services)
      url += "^standard_services=" + requestObj.standard_services;

    if (requestObj.reservable_purposes)
      url += "^reservable_purposesIN" + requestObj.reservable_purposes;

    return url;
  }

  /**
   *
   * @param {HttpPromise} response
   * @returns {*} parsed result out of api response
   * @private
   */
  function _resultParser(response) {
    return response.data.result;
  }

  // return exposed methods
  return {
    getReservableModule: getReservableModule,
    getAvailableReservables: getAvailableReservables,
    checkReservablesAvailabilities: checkReservablesAvailabilities,
    checkExistingReservation: checkExistingReservation,
  };

  /**
   * Request object for fetching available reservables
   * @typedef SearchRequestObject
   * @property {string} reservable_module - sys_id of the reservable module
   * @property {string} start - start time of the reservation as UTC string
   * @property {string} end - start time of the reservation as UTC string
   * @property {string} reserved_reservables - list of reserved reservable ids
   * @property {string} reservation_ids - list of possible editing reservation
   */

  /**
   * Request object for checking availability
   * @typedef AvailablityCheckRequestObject
   * @property {string} reservable_module - sys_id of the reservable module
   * @property {string} start - start time of the reservation as UTC string
   * @property {string} end - start time of the reservation as UTC string
   * @property {string} reservable_ids - list of reservable ids to check
   * @property {string} reservation_ids - list of possible editing reservations (avoid collision with its own reservation)
   */

  /**
   * angular http promise https://docs.angularjs.org/api/ng/service/$http#$http-returns
   * @typedef HttpPromise
   * @property {string|Object} data – The response body transformed with the transform functions.
   * @property {number}  status – HTTP status code of the response.
   * @property {function([headerName])} headers – Header getter function.
   * @property {Object}  config – The configuration object that was used to generate the request.
   * @property {string}  statusText – HTTP status text of the response.
   * @property {string}  xhrStatus – Status of the XMLHttpRequest (complete, error, timeout or abort).
   */
}
