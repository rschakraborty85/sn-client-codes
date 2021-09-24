api.controller = function($scope,  $location, $timeout, $templateCache, cabrillo, wsdStateService, wsdReservableSearch, wsdReservableMappingService, wsdMappedinService, wsdReservationBasket, wsdUtils) {
  // , spUtil , $window,
  var c = this;
 // Used to determine if Cabrillo is executing in ServiceNow's native mobile apps.
 c.isNative = cabrillo.isNative();

 var VIEW_OPTIONS = [
   {
     active: true,
     type: "card",
     label: "${Card view}",
     iconClass: "fa-th-large",
     text: "${Tile view}",
   },
   {
     active: false,
     type: "schedule",
     label: "${Schedule view}",
     iconClass: "fa-calendar-o",
     text: "${Gantt view}",
   },
 ];
 if (c.data.isMappedinInstalled)
   VIEW_OPTIONS.push({
     active: false,
     type: "map",
     label: "${Map view}",
     iconClass: "fa-map-marker",
     text: "${Map view}",
   });

 var DEFAULT_RESERVATION_PAGE_ID = "wsd_reservation";
 var DEFAULT_DEBOUNCE_TIME = 350; // milisecond

 c.isRegularSearch = false;
 c.filterCount = 0;
 c.activeView = null;
 c.viewOptions = null;
 c.reservationId = null;
 c.reservableMapper = null;
 c.hasMore = false;
 c.isEditing = false;
 c.mappedReservables = []; // the view model of the original reservables
 c.selectedItems = []; // the list of user selected items
 c.searching = false;
 c.wasSearched = false;
 c.searchWasAuto = false;
 c.showReservableFilter = false;
 c.watcher = {};
 c.isOccurrence = false;
 c.canSubmitReservation = true;
 c.missingSpaceMap = false;
 c.wsdMappedinReservationData = null;
 c.mappedinConfig = {};
 c.showMappedin = false;
 c.isRecurring = false;
 c.floorReservables = [];
 c.onMapSpaceSelect = onMapSpaceSelect;
 c.mountWsdMappedinComponent = mountWsdMappedinComponent;
 c.wsdMappedinTemplates = {
   popupcard: $templateCache.get("map-rsv-popup.html"),
   tooltip: $templateCache.get("map-default-rsv-tooltip"),
 };
 c.resultMsg = {
   title: "",
   msg: "",
 };
 var lastMapFilters = {};

 // notification
 c.notificationConfig = {};
 c.showNotification = false;

 c.hasError = false;

 c.editInfo = null;

 // bind methods:
 c.undoChangesAndBackToReservation = undoChangesAndBackToReservation;
 c.reserveReservable = reserveReservable;
 c.reserveReservables = reserveReservables;
 c.toggleReservableSelection = toggleReservableSelection;
 c.unSelectAll = unSelectAll;
 c.toggleViewOption = toggleViewOption;
 c.toggleReservableFilter = toggleReservableFilter;
 c.isChangeLocationDisabled = isChangeLocationDisabled;
 c.scheduleViewTotalStep = 5;
 c.isMultiItemSelection = false;
 c.loadMore = loadMore;
 c.onSortByChange = onSortByChange;
 c.$onInit = init;
 $scope.$on("$destroy", destroy);
 c.previouslySelected = {};
 c.initialLoadFoReselectCheck = false;

 /** initialization function */
 function init() {
   _checkThisBeforeEverythingElse();
   _createModuleWatcher();
   _createReservableWatcher();
   _createSearchingStateWatcher();
   _createResultsFitSearchWatcher();
   _createFilterCountWatcher();
   _createReservableFilterWatcher();
   _createReservationBasketWatcher();
   _createIsRecurringWatcher();
   _createWindowResizeEventListener();

   try {
     c.reservationId = $location.search().reservationId;
     c.viewOptions = VIEW_OPTIONS.slice(0, 2);
     c.options.page_size = parseInt(c.options.page_size);
     c.reservable_module = c.data.reservable_module;

     toggleViewOption(c.viewOptions[0], true);
     _prepareSortBy();
     _prepareSearchMode();
   } catch (ex) {
     // RC - changed error structure
     // var errorMsg =
     //	"${An error has occurred while starting up. Please try again}";
     _showNotification(true, ex, "alert-danger", "fa-exclamation-triangle");
   }
 }

 /**
  * RC - changed ; added new logic
  * to check existing reservation
  * open the reservation page, or send data to the reservation widget on the same page depending on widget options
  * @param {string[]} reservableIds - an array of string ids
  */
 function processToReserve(reservableIds) {
   //console.log("RC wsd search client processToReserve");
   var searchRequestObj = wsdStateService.getState("searchRequestObj");
   var recurringPattern = wsdStateService.getState("recurringPattern");
   // RC - change start
   var sysDtFormat = "YYYY-MM-DD HH:mm:ss"; // convert any user format to system
   var start = moment(searchRequestObj.start).format(sysDtFormat);
   var end = moment(searchRequestObj.end).format(sysDtFormat);
   var building_id = searchRequestObj.building;
   var reservable_module_id = searchRequestObj.reservable_module;
   // console.log(
   //   "RC wsd search client data.reservation_id " + c.data.reservation_id
   // );
   //  build request object
   var requestObj = {
     start: start,
     end: end,
     building_id: building_id,
     reservable_module_id: reservable_module_id,
     reservation_id: c.data.reservation_id ? c.data.reservation_id : "",
   };
   // call service if not in edit mode

   wsdReservableSearch
     .checkExistingReservation(requestObj)
     .then(function (isReserveExist) {
       //console.log("RC isReserveExist " + isReserveExist);
       // if (isReserveExist ) {//&& c.mode != "edit"
         var msg =
           "Reservation already exist for the same searched day, cannot proceed!";
       //   _showNotification(
       //     true,
       //     msg,
       //     "alert-danger",
       //     "fa-exclamation-triangle"
       //   );
         // added extra cause above one dont refocus
       //   spUtil.addErrorMessage(msg);
       //   return false;
       // } else {
         var targetPageId = c.options.reservation_page_id
           ? c.options.reservation_page_id
           : DEFAULT_RESERVATION_PAGE_ID;
         var pageParam = {
           id: targetPageId,
           reservable_ids: reservableIds.join(","),
           start: searchRequestObj.start,
           end: searchRequestObj.end,
         };

         if (recurringPattern !== null)
           pageParam.recurring_pattern = encodeURI(
             JSON.stringify(recurringPattern)
           );

         if (c.mode === "edit")
           pageParam.reservation_ids = searchRequestObj.reservation_ids;
         else pageParam.reservable_module = searchRequestObj.reservable_module;

         var shiftId = searchRequestObj.shift;
         if (shiftId) pageParam.shift_id = shiftId;

         // redirect to the target reservation page
         wsdStateService.setPageState("currentReservation", pageParam, false);
       // }
     });
 }

 // RC
 function _checkThisBeforeEverythingElse() {
   try {
     if (_isRtoSelfReserveUser()) {
       // allow to continue
     } else {
       throw "${You donot have access to view this page}";
     }
     _isUserTravelling(); // on load - check if user tz and building tz is diff
   } catch (ex) {
     // RC - changed error structure
     // var errorMsg =
     //	"${An error has occurred while starting up. Please try again}";
     _showNotification(true, ex, "alert-danger", "fa-exclamation-triangle");
   }
 }

 // RC - added new function
 function _isRtoSelfReserveUser() {
   return c.data.isRtoSelfReserveUser;
 }
 // RC - new function
 function _isUserTravelling() {
   try {
     var shortObj = c.data.user_building_tz;
     // console.log("RC in client shortObj " + JSON.stringify(shortObj))
     var userTz = shortObj.user_tz;
     var buildTz = shortObj.building_tz;

     if (userTz != buildTz) {
       // console.log("shortObj.warning_msg " + shortObj.warning_msg);
       // _showNotification(
       // 					shortObj.warning_msg,
       // 					"alert-warning",
       // 					"fa-exclamation-triangle"
       // 				);
       _removeNotification();
       c.isUserTravelling = true;
       //throw shortObj.warning_msg;
       // c.showNotification = true;
       // console.log("c.showNotification " + c.showNotification);
     } else {
       c.isUserTravelling = false;
       // scope.showSearchNotification = false;
     }
   } catch (e) {
     //console.log(e);
     _showNotification(e, "alert-danger", "fa-exclamation-triangle");
   }
 }
 /**
  * RC - changed
  * Display a notification if the user changed search settings without searching again results deviate so the users should be made aware
  * @private
  */
 function _createResultsFitSearchWatcher() {
   // console.log("does it work on load ?");
   var watcherId = "resultsDeviate";
   if (c.watcher[watcherId]) return;

   c.watcher[watcherId] = wsdStateService.subscribe(
     watcherId,
     function (old, deviates) {
       if (deviates && !wsdStateService.getState("settingAutoSearchValues"))
         _showSearchDeviatesNotification();
       else {
         // console.log("does it work on load and the else block ?");
         c.isUserTravelling ? "" : _removeNotification();
         _removeNotification();
       }
     }
   );
 }
 /**
  * RC - changed
  * Display a notification to the user containing information related to the state of the search
  * @param {boolean} hasError - indicates whether this is an error notification
  * @param {string} [msg] - message that should be displayed to the end user
  * @param {string} [type] - type of notification that should be displayed (success, info, warning, danger)
  * @param {string} [icon] - icon that should be displayed (e.g., fa-info-circle)
  * @return {void}
  * @private
  */
 function _showNotification(hasError, msg, type, icon) {
   // console.log("do i see u ? _showNotification");
   c.hasError = hasError;
   msg = msg ? msg : "${An error has occurred. Please try again}";
   c.notificationConfig = {
     msg: msg,
     type: type,
     icon: icon,
   };
   c.showNotification = true;
 }
 /**
  * prepare search mode (new search or editing existing reservation), and set data accordingly
  * @private
  */
 function _prepareSearchMode() {
   c.mode = c.data.mode;
   c.isEditing = c.mode === "edit";
   c.title = c.isEditing ? "${Update reservation}" : "${Make a reservation}";

   if (c.isEditing) {
     // EDITING MODE
     c.reservation = c.data.reservation;

     // check if reservation is valid for editing
     if (!_isReservationValidForEdit()) return;

     if (c.reservation.reservation_subtype)
       c.isOccurrence =
         c.reservation.reservation_subtype.value === "occurrence";

     if (c.isOccurrence) c.title = "${Edit an occurrence in a series}";

     // fetch mapper based on the know reservable module
     c.reservableMapper = wsdReservableMappingService.createReservableMapper(
       c.reservation.reservable_module
     );
     c.wasSearched = true;

     var reservables = _getReservablesFromReservation(c.reservation);

     // on first load, all reserved items are also selected
     var reservationSelectedIds = reservables.map(function (item) {
       return item.sys_id;
     });
     wsdReservationBasket.prime(reservationSelectedIds);
     c.previouslySelected = reservationSelectedIds.reduce(function (
       total,
       current
     ) {
       total[current] = true;
       return total;
     },
     {});

     _resolveReservablesResult(reservables, true);
   } else {
     if (
       c.reservable_module &&
       (_.isEmpty(c.data.initSearchConfig) ||
         _.isNull(c.data.initSearchConfig.reservable_module))
     ) {
       var msg =
         "${The preselected type is unavailable. Please select a different type to make a reservation}";
       _showNotification(true, msg, "alert-danger", "fa-exclamation-triangle");
     }

     wsdReservationBasket.prime([]);
   }
 }

 /**
  * Check if the reservation is valid for editing
  * @return {boolean}
  * @private
  */
 function _isReservationValidForEdit() {
   var errorMsg;
   var errorMsgBuilding =
     "${Invalid reservation to edit. The selected building is invalid or no-longer exists}";
   var notificationType = "alert-danger";
   var notificationIcon = "fa-exclamation-triangle";

   if (!c.reservation || !c.reservation.sys_id) {
     errorMsg =
       "${Invalid reservation to edit. The selected reservation is invalid or no-longer exists}";
     _showNotification(true, errorMsg, notificationType, notificationIcon);
     return false;
   }

   if (!c.reservation.reservable_module) {
     errorMsg =
       "${Invalid reservation to edit. The selected module is invalid, no-longer exists or not active on this day}";
     _showNotification(true, errorMsg, notificationType, notificationIcon);
     return false;
   }

   if (
     c.reservation.location &&
     c.reservation.location.building &&
     !c.reservation.location.building.active
   ) {
     _showNotification(
       true,
       errorMsgBuilding,
       notificationType,
       notificationIcon
     );
     return false;
   }

   var locations = c.reservation.locations;
   if (
     wsdUtils.arrayHasElement(locations) &&
     locations[0] &&
     locations[0].building &&
     !locations[0].building.active
   ) {
     _showNotification(
       true,
       errorMsgBuilding,
       notificationType,
       notificationIcon
     );
     return false;
   }

   return true;
 }

 /**
  * extract reservables from reservation (for edit mode).
  * @param {Reservation} reservation
  * @return {Reservable[]} fetched reservables from editing reservation. Result: location if it's a single, and locations if it's a multi-child reservation
  */
 function _getReservablesFromReservation(reservation) {
   var reservables = [];
   if (reservation.reservable_module.reservable_type === "location") {
     if (_isMultiChildReservation(reservation)) {
       reservation.locations.forEach(function (loc) {
         loc.is_reserved = true;
         loc.is_selected = true;
       });

       reservables = reservation.locations;
     } else {
       reservation.location.is_reserved = true;
       reservables.push(reservation.location);
     }
   }

   return reservables;
 }

 /**
  * checkf if the editing reservation is multi child reservation
  * @return {boolean}
  * @private
  */
 function _isMultiChildReservation(reservation) {
   return wsdUtils.arrayHasElement(reservation.locations);
 }

 /**
  * Initialize the sortBy
  */
 function _prepareSortBy() {
   c.sortByOptions = [
     {
       id: "a_z",
       text: !c.isNative ? "${Alphabetically}" : "${Alphabetically A-Z}",
       icon: "fa-sort-alpha-asc",
       hint: "${Alphabetically a to z}",
     },
     {
       id: "z_a",
       text: !c.isNative ? "${Alphabetically}" : "${Alphabetically Z-A}",
       icon: "fa-sort-alpha-desc",
       hint: "${Alphabetically z to a}",
     },
   ];

   c.sortBy = c.data.initSearchConfig.sortBy;
   if (!c.sortBy) c.sortBy = c.sortByOptions[0].id;
   wsdStateService.setState("searchSortBy", c.sortBy);

   c.sortBySelect2Options = {
     data: c.sortByOptions,
     minimumResultsForSearch: 0,
     formatResult: buildSortByItemTemplate,
     formatSelection: buildSortByItemTemplate,
   };
   c.sortByDisabled = false;
 }

 /**
  * undo changes and go back to edit reservation details page. Callable on unavailable selection
  */
 function undoChangesAndBackToReservation() {
   var targetPageId = c.options.reservation_page_id
     ? c.options.reservation_page_id
     : DEFAULT_RESERVATION_PAGE_ID;
   var pageParam = {
     id: targetPageId,
     reservation_id: c.reservation.sys_id,
   };

   // redirect to the target reservation page
   wsdStateService.setPageState("currentReservation", pageParam, false);
   return;
 }

 /**
  * Handles the sort change
  */
 function onSortByChange() {
   wsdStateService.setState("searchSortBy", c.sortBy);
   _triggerSearch();
 }

 /**
  * Builds the html for the sort by options
  * @param {SortByOption} item Sort By option to render html for
  * @returns {string}
  */
 function buildSortByItemTemplate(item) {
   // Needs inline style because the select2 is rendered outside our widget, so we cannot style it though css.
   if (c.isNative)
     return wsdUtils.formatString(
       '<span title="{0}" aria-label="{0}">{1}</span>',
       item.hint,
       item.text
     );

   return wsdUtils.formatString(
     '<span title="{0}" aria-label="{0}">{1}<i class="fa {2}" style="margin-left: 10px;"></i></span>',
     item.hint,
     item.text,
     item.icon
   );
 }

 /**
  * toggle between view type, and set resultViewType state
  * @param {object} viewOption
  * @param {boolean} ignoreTriggerSearch - should trigger search
  */
 function toggleViewOption(viewOption, ignoreTriggerSearch) {
   c.activeView = viewOption;
   c.sortByDisabled = c.activeView.type === "map";
   wsdStateService.setState("resultViewType", viewOption.type);

   if (ignoreTriggerSearch) return;

   _triggerSearch(viewOption.type, false);
 }

 /**
  * Toggle the reservable filter
  */
 function toggleReservableFilter() {
   c.showReservableFilter = !c.showReservableFilter;
   _evaluateScheduleViewSteps();
 }

 /**
  * Returns whether or not the location (building) can be changed
  * @returns {boolean}
  */
 function isChangeLocationDisabled() {
   return (
     (c.isEditing && c.reservation && c.reservation.shift) ||
     c.selectedItems.length >= 1
   );
 }

 /**
  * notify search provider to research
  * @param {string} viewType - view type (card or schedule), if not given, the last known view type will be used
  * @param {boolean} isPaginationSearch - whether the it's a new search or pagination
  * @param {boolean} [clearFilter] - clear out the reservable filter data before executing the search
  * @private
  */
 function _triggerSearch(viewType, isPaginationSearch, clearFilter) {
   viewType = viewType ? viewType : wsdStateService.getState("resultViewType");
   var searchOption = {
     viewType: viewType,
     isPaginationSearch: isPaginationSearch,
     pageSize: c.options.page_size,
   };

   if (clearFilter) _resetReservableFilterData();

   wsdStateService.setState("triggerSearch", searchOption);
 }

 /**
  * select or deselect reservable, then resolve selection items
  * @param {Reservable} reservable - reservable to toggle selection
  */
 function toggleReservableSelection(reservable) {
   // once an unavailable space is deselected it can not be re-added
   if (!reservable.is_available && !reservable.is_selected) return;

   if (reservable.is_selected) c.previouslySelected[reservable.sys_id] = true;
   else c.previouslySelected[reservable.sys_id] = false;

   // update selected ids list
   wsdReservationBasket.toggle(reservable.sys_id);
 }

 /**
  * de-select all selected items
  */
 function unSelectAll() {
   wsdReservationBasket.clear();
 }

 /**
  * reserve a single reservable
  * @param {string} reservableId - sys_id of the target reservable
  */
 function reserveReservable(reservableId) {
   processToReserve([reservableId]);
 }

 /**
  * reserve multiple reservables (multi-child reservation)
  */
 function reserveReservables() {
   var reservableIds = c.selectedItems.map(function (item) {
     return String(item.sys_id);
   });

   wsdStateService.setState("recurringPattern", null);
   processToReserve(reservableIds);
 }

 /**
  * listen to searching status changes
  */
 function _createSearchingStateWatcher() {
   var toWatch = "searching";
   if (c.watcher[toWatch]) return;

   c.watcher[toWatch] = wsdStateService.subscribe(
     toWatch,
     function (old, searchingState) {
       c.searching = searchingState;
       c.wasSearched = true;
       c.searchWasAuto = wsdStateService.getState("searchWasAuto");

       if (c.searchWasAuto)
         c.autoSearchResultSubTitle = wsdStateService.getState(
           "autoSearchResultSubTitle"
         );
     }
   );
 }

 /**
  * listen to isRecurring flag changes
  */
 function _createIsRecurringWatcher() {
   var toWatch = "isRecurring";
   if (c.watcher[toWatch]) return;

   c.watcher[toWatch] = wsdStateService.subscribe(
     toWatch,
     function (old, isRecurring) {
       c.isRecurring = isRecurring;
     }
   );
 }

 /**
  * availableReservables is triggered once reservables are loaded based on a search query
  * @private
  */
 function _createReservableWatcher() {
   var toWatch = "availableReservables";
   if (c.watcher[toWatch]) return;

   c.watcher[toWatch] = wsdStateService.subscribe(
     toWatch,
     function (old, reservables) {
       //console.log("RC _createReservableWatcher reservables ");
       // monitor filters to retest availability of selected spaces upon change
       var searchRequestObj = wsdStateService.getState("searchRequestObj");
       wsdReservationBasket.setFilterConstraints({
         start_at: moment(searchRequestObj.start),
         end_at: moment(searchRequestObj.end),
         building_id: searchRequestObj.building,
         reservable_module_id: searchRequestObj.reservable_module,
         shift_id: searchRequestObj.shift,
         reservation_ids: searchRequestObj.reservation_ids
           ? searchRequestObj.reservation_ids.split(",")
           : null,
       });

       _resolveReservablesResult(reservables);
       _evaluateAvailabilityResult(reservables);

       // inform the view to refresh accordingly
       wsdStateService.setState("refreshView");
     }
   );
 }

 /**
  * Calc the amount of selected filters from the reservable filter directive
  * @private
  */
 function _createFilterCountWatcher() {
   var toWatch = "triggerFilterCount";
   if (c.watcher[toWatch]) return;

   c.watcher[toWatch] = wsdStateService.subscribe(
     toWatch,
     function (old, filterCountObj) {
       // when amount is send as 0, it indicates a reset of the filter
       if (filterCountObj.amount === 0) return (c.filterCount = 0);
       else if (filterCountObj.amount > 0)
         return (c.filterCount = filterCountObj.amount);

       filterCountObj.add ? (c.filterCount += 1) : (c.filterCount -= 1);
     }
   );
 }

 /**
  * evaluate and check if the selected reservable is still available
  * @param {Reservable[]} reservables
  * @private
  */
 function _evaluateAvailabilityResult(reservables) {
   if (!c.isEditing || !reservables) return;

   // first check if there is any mismatched reservables
   var hasMismatched = reservables.some(function (reservable) {
     return reservable.is_mismatched;
   });

   if (hasMismatched) {
     _setMismatchSearchNotitication(true);
     return;
   }
 }

 /**
  * Removes an notification
  * @private
  */
 function _removeNotification() {
   c.notificationConfig = {};
   c.showNotification = false;
 }

 /**
  * displays a notification, that search does not match results where user can click to get new results
  * @private
  */
 // breakpoint
 function _showSearchDeviatesNotification() {
   var msg = "${You've updated the search criteria.}"; //escaping quote doesn't work in translation, therefore using double quote for defining this string
   c.notificationConfig = {
     msg: msg,
     type: "alert-info",
     icon: "fa-info-circle",
     callbackText: "${Refresh the results}",
     callback: function () {
       c.searchWasAuto = false;
       wsdStateService.setState("searchWasAuto", false, true);
       _triggerSearch(null, false, true);
     },
   };
   c.showNotification = true;
 }

 /**
  * displays a notification, the profiled module is invalid or unavailable
  * @private
  */
 function _showInvalidModuleNotification() {
   var msg =
     "${The requested reservable type is not available, please select a different one to create the reservation}.";
   c.notificationConfig = {
     msg: msg,
     type: "alert-warning",
     icon: "fa-exclamation-triangle",
   };
   c.showNotification = true;
 }

 /**
  * set mismatched reservables data and the search filter. Used in edit mode
  * @param {boolean} hasMismatched - if there is any mismatched reservable compare to search filter.
  * @private
  */
 function _setMismatchSearchNotitication(hasMismatched) {
   if (!hasMismatched) {
     c.editInfo = {
       hasAvailabilityError: false,
     };
     return;
   }

   var msg =
     "${Your reserved item does not match the search criteria. You can choose another one, or undo the changes}.";

   if (c.isMultiItemSelection)
     var msg =
       "${One of your reserved items do not match the search criteria. You can choose another one, or undo the changes}.";

   var actionText = "${Click to undo}.";

   c.editInfo = {
     hasAvailabilityError: true,
     msg: msg,
     actionText: actionText,
   };
 }

 /**
  * set availability notification. Used in edit mode
  * @param {boolean} hasAvailabilityError - indicates whether the selected item is still available
  * @private
  */
 function _setAvailabilityNotification(hasAvailabilityError) {
   var msg = hasAvailabilityError
     ? "${One or more selected items are unavailable for the time you have selected. You can choose another one, or undo the changes}."
     : "${The selected item(s) are available. You can choose another one, or undo the changes}.";

   var actionText = hasAvailabilityError
     ? "${Click to undo}."
     : "${Go back to my reservation}.";

   c.editInfo = {
     hasAvailabilityError: hasAvailabilityError,
     msg: msg,
     actionText: actionText,
   };
 }

 /**
  * resolve and prepare reservables for result view.
  * @param {Reservable[]} reservables - list of the reservable result.
  * @param {boolean} [isInitialLoad] - defaults to false, should be true once its called in initial load
  * @private
  */
 function _resolveReservablesResult(reservables, isInitialLoad) {
   // console.log(
   //   "RC _resolveReservablesResult reservables " + JSON.stringify(reservables)
   // );
   if (!wsdUtils.arrayHasElement(reservables)) {
     // No result - when there are no result or error occurred
     if (c.isEditing) _setAvailabilityNotification(true);

     c.mappedReservables = [];
     c.hasMore = false;
     var searchResultMsg = wsdStateService.getState("searchResultMsg");
     _setMainResultPanelMsg(false, searchResultMsg);
     return;
   }

   // When there are reservables
   try {
     // validates that all reservables loaded match the last searched building (Edit mode).
     // If not, those reservables will be made unavailable
     // used mainly when multi reservation is editing and changing building
     var searchRequestObj = wsdStateService.getState("searchRequestObj");
     if (c.isEditing && searchRequestObj && searchRequestObj.building) {
       reservables.forEach(function (reservable) {
         if (
           reservable.building &&
           reservable.building.sys_id !== searchRequestObj.building
         ) {
           reservable.is_available = false;
           reservable.is_mismatched = true;
         } else if (
           c.previouslySelected[reservable.sys_id] &&
           c.initialLoadFoReselectCheck
         ) {
           // when in edit mode, day is set to conflicting date, and then set to a non conflicting date it should re-select
           reservable.is_selected = true;
           if (!wsdReservationBasket.isSelected(reservable.sys_id))
             wsdReservationBasket.toggle(reservable.sys_id);
         }
       });
     }
     if (!isInitialLoad) c.initialLoadFoReselectCheck = true;

     var resultViewType = wsdStateService.getState("resultViewType");
     resultViewType = resultViewType ? resultViewType : "card";

     // simply check if the search provider actually has more result
     c.hasMore = wsdStateService.getState("searchResultHasMore");
     c.mappedReservables = reservables.map(c.reservableMapper);

     if (resultViewType === "map") {
       mountWsdMappedinComponent(null);
     } else if (resultViewType === "schedule") _evaluateScheduleViewSteps();

     var origin = isInitialLoad ? "init" : "landing";
     _evaluateSelectionAndUpdateFeedback({
       origin: origin,
     });
   } catch (ex) {
     console.warn("resolveReservablesResult error", ex);
     c.hasError = true;
     var errorMsg =
       "${An error has occurred while processing search result. Please try again}";
     _showNotification(
       true,
       errorMsg,
       "alert-danger",
       "fa-exclamation-triangle"
     );
   }
 }

 /**
  * set result message and fetch possible result message (if given)
  * @param {boolean} hasResult - if there is no result, the messeage will be shown
  * @param {string} [resultMessage] when there is no result, and the message is given, it will be displayed, otherwise default message will be used.
  */
 function _setMainResultPanelMsg(hasResult, resultMessage) {
   if (hasResult) return;

   // when there is no result
   if (c.isRegularSearch) {
     c.resultMsg.title = "${There are no available results for your search}";
     c.resultMsg.msg = resultMessage
       ? resultMessage
       : "${Sorry about that! You can search to reserve something else, or try another time or location.}";
   } else {
     c.resultMsg.title = "${There are no results to display}";
     c.resultMsg.msg = resultMessage
       ? resultMessage
       : "${Please try again by removing the filters or searching for something else.}";
   }
 }

 /**
  * module watcher is triggered on change of the selected module, and will generate a mapper from reservable
  * definition to tile that will be used on the data of each reservable
  * @private
  */
 function _createModuleWatcher() {
   var toWatch = "selectedReservableModule";
   if (c.watcher[toWatch]) return;

   // this state is changed in the wsdSearchFilterDirective
   c.watcher[toWatch] = wsdStateService.subscribe(
     toWatch,
     function (old, reservableModule) {
       c.reservableMapper = reservableModule
         ? reservableModule.reservableMapper
         : null;
       _checkShowMapView();
     }
   );
 }

 /**
  * Watcher is triggered when doing search (both regular and filtered search)
  * will have a value when a filtered search is used, will be empty on regular search
  * @private
  */
 function _createReservableFilterWatcher() {
   var toWatch = "reservableFilter";
   if (c.watcher[toWatch]) return;

   c.watcher[toWatch] = wsdStateService.subscribe(
     toWatch,
     function (old, reservableFilter) {
       c.isRegularSearch = !reservableFilter;
     }
   );
 }

 /**
  * Adds _evaluateSelectionAndUpdateFeedback as a listener for changes to the
  * selected item basket
  * @private
  */
 function _createReservationBasketWatcher() {
   // Trigger synchronously after items are selected/deselected
   wsdReservationBasket.on(
     "selectionChange",
     _evaluateSelectionAndUpdateFeedback
   );
 }

 /**
  * Updates the is_selected flag of the items in mappedReservables and floorReservables
  * if the items are still in the reservation basket
  * @param {EventDetails} evt - the details about the event that caused the change
  * @private
  */
 function _evaluateSelectionAndUpdateFeedback(evt) {
   evt = evt || {};

   // optimistic sync of the is_selected flag for both map and cards (displayed only)
   c.mappedReservables.forEach(function (item) {
     item.is_selected = wsdReservationBasket.isSelected(item.sys_id);
   });
   c.floorReservables.forEach(function (item) {
     item.is_selected = wsdReservationBasket.isSelected(item.sys_id);
   });

   if (
     evt.origin !== "validation" &&
     evt.origin !== "navigation" &&
     evt.origin !== "init"
   )
     _validateSelection();

   if (c.activeView.type === "map") {
     c.wsdMappedinReservationData =
       wsdMappedinService.generateAvailabilityIndex(
         c.floorReservables,
         new Set(wsdReservationBasket.getSelectedIds())
       );
     c.wsdMappedinReservationData.legends = _getMapLegend();
   }
 }

 /**
  * Validates the items in the reservation basket and shows a message if items
  * are no longer available. Also updates the floor selector options if we're
  * currently on the map view
  * @private
  */
 function _validateSelection() {
   var selectedItemIds = wsdReservationBasket.getSelectedIds();
   c.isMultiItemSelection = selectedItemIds.length > 1;
   c.canSubmitReservation = false;

   wsdReservationBasket.validateSelected().then(function (validation) {
     c.canSubmitReservation = true;
     c.selectedItems = validation.availableReservables;
     c.isMultiItemSelection = validation.availableReservables.length > 1;

     // If there were exceptions, there were items emoved from the selection because
     // they were no longer available
     if (validation.hasRemovedItems)
       _showUnavailableSelectionNotification(validation);
     else _showStillAvailableSelectionNotification(validation);

     if (c.activeView.type === "map" && c.mappedinConfig.floorData)
       c.mappedinConfig.floorData = _generateFloorSelectorData(
         c.mappedinConfig.floorData
       );
   });
   /*
                 // RC - change start
                     .catch(function(err) {
                     c.selectedItems = [];
                     if (err) { throw err; }
                 });
                 // RC - change end
                 */
 }

 /**
  * Shows a message that previously selected items no longer available
  * @param {object} validation - the validation object
  * @param {Array[Reservable]} validation.removedSelectedItems - the reservables that were removed (formerly was: validation.reservableReservables)
  * @private
  */
 function _showUnavailableSelectionNotification(validation) {
   if (c.isEditing) {
     _setAvailabilityNotification(true);
     return;
   }
   var msg =
     "${Your search criteria has changed; some selected items are not available. The items have been deselected.}";
   c.notificationConfig = {
     msg: msg,
     type: "alert-warning",
     icon: "fa-exclamation-triangle",
   };
   c.showNotification = true;
 }

 /**
  * Sets the availability notification if we're in edit mode
  * @private
  */
 function _showStillAvailableSelectionNotification(validation) {
   if (c.isEditing && validation.availableReservables.length > 0)
     _setAvailabilityNotification(false);
 }

 /**
  * create window resize event listner to adapt view rendering if applicable
  * debounce after default amount of time
  */
 function _createWindowResizeEventListener() {
   window.addEventListener(
     "resize",
     debounce(function (e) {
       _evaluateScheduleViewSteps();
     })
   );
 }

 /**
  * Clear out all the reservable filter data, usually happens when a new search is executed through the search input
  * @private
  */
 function _resetReservableFilterData() {
   wsdStateService.setState("activeReservableFilter", null);
   wsdStateService.setState("reservableFilter", null);
   c.filterCount = 0;
 }

 /**
  * re-evaluate the scheduleview total step
  * @private
  */
 function _evaluateScheduleViewSteps() {
   if (c.activeView.type !== "schedule") return;

   $timeout(function () {
     c.scheduleViewTotalStep = _getScheduleViewTotalSteps();
   }, 100);
 }

 /**
  * get a numeric value of possible total steps for sheduleView.
  * For smaller width of the browser window, the step will be fixe to 2 or 3. When the window's width is bigger,
  * depending on whether the filter is opened, the total step will be smaller or bigger
  * @return {number} total step
  * @private
  */
 function _getScheduleViewTotalSteps() {
   var windowWidth = wsdUtils.getWindowWidth();

   if (windowWidth <= 576) return 2;

   if (windowWidth <= 991) return 3;

   return c.showReservableFilter ? 3 : null;
 }

 /**
  * Get a list of unavailable reservables
  * @param {Reservable[]}
  * @return {Reservable[]}
  * @private
  */
 function _getUnavailableReservables(reservables) {
   if (!wsdUtils.arrayHasElement(reservables)) return [];

   return reservables.filter(function (reservable) {
     return !reservable.is_available;
   });
 }

 /**
  * trigger next page search
  */
 function loadMore() {
   _triggerSearch(null, true);
 }

 /**
  * on widget destroy, deregister all watchers, and clean out state values
  */
 function destroy() {
   wsdStateService.reset();
 }

 /**
  * deboucing event
  * @param {function} func - function to be called after debouced time
  */
 function debounce(func) {
   var timer;
   return function (event) {
     if (timer) clearTimeout(timer);

     timer = setTimeout(func, DEFAULT_DEBOUNCE_TIME, event);
   };
 }

 /**
  * Populate the space collection for <wsd-mappedin-map>
  * if Mappedin plugin is installed
  * @param {String} selectedFloorId - floor to be preselected
  */
 function mountWsdMappedinComponent(selectedFloorId) {
   if (!c.data.isMappedinInstalled) return;
   if (c.activeView.type !== "map") return;

   // hide "Show More" button
   c.hasMore = false;

   var filterState = wsdStateService.getState("searchRequestObj");
   var inFlightRequestId = Math.round(Math.random() * 1e10).toString();
   var filters = {
     reservation: c.mode === "edit" ? c.reservation : null,
     building_id: filterState.building,
     reservable_module_id: filterState.reservable_module,
     start_at: moment(filterState.start),
     end_at: moment(filterState.end),
     capacity: filterState.capacity,
     floor_ids: filterState.floors ? filterState.floors.split(",") : [],
     standard_services: filterState.standard_services
       ? filterState.standard_services.split(",")
       : [],
     reservable_purposes: filterState.reservable_purposes
       ? filterState.reservable_purposes.split(",")
       : [],
     request_id: inFlightRequestId,
     sort_by: filterState.sort_by,
   };

   // reset the Mappedin instance and reservation data if filter constrains changed
   var hasFilterChanged = !wsdMappedinService.filterIsEqual(
     lastMapFilters,
     filters,
     {
       ignore: ["request_id"],
     }
   );
   if (hasFilterChanged) {
     c.mappedinConfig = {};
     c.wsdMappedinReservationData = null;
   }

   c.showMappedin = true;
   c.missingSpaceMap = false;
   lastMapFilters = filters;

   wsdMappedinService
     .getAvailabilityFacets(filters)
     .then(function (availFacets) {
       if (
         !availFacets.floors.length ||
         availFacets.filters.request_id !== inFlightRequestId
       )
         // abort if no results or user changes filters while in flight
         return Promise.resolve([
           {
             reservableUnits: [],
             filters: {},
           },
           {},
           availFacets,
           {},
         ]);

       // among the available floors pick the selected on or the first as default
       var selectedFloor =
         availFacets.floors.find(function (floor) {
           return floor.sys_id === selectedFloorId;
         }) || availFacets.floors[0];

       var floorFilter = Object.assign({}, filters, {
         floor_id: selectedFloor.sys_id,
         floor_ids: null,
       });

       // request availability for the selected floor
       return Promise.all([
         wsdMappedinService.getFloorAvailability(floorFilter),
         wsdMappedinService.resolveVenueFromFloor(selectedFloor.sys_id),
         Promise.resolve(availFacets),
         Promise.resolve(selectedFloor),
       ]);
     })
     .then(function (taskResults) {
       var reservableUnits = taskResults[0].reservableUnits;
       var mapParams = taskResults[1];
       var requestId = taskResults[2].filters.request_id;
       var availableFloors = taskResults[2].floors;
       var selectedFloor = taskResults[3];

       // user changed filters, results are stale, abort
       if (requestId !== inFlightRequestId) return Promise.resolve(null);

       // show "no results" banner
       if (!reservableUnits.length) c.mappedReservables = [];

       // show "no map" banner and exit function if appropriate
       c.missingSpaceMap = reservableUnits.length && !mapParams.venue;
       if (c.missingSpaceMap) {
         c.showMappedin = false;
         return;
       }

       // else render the selected floor and related availability
       c.mappedinConfig = {
         venueSlug: mapParams.venue,
         mapId: mapParams.map,
         floorData: _generateFloorSelectorData(availableFloors),
         floorId: selectedFloor.sys_id,
         colors: wsdMappedinService.getColorTheme("reservation"),
         title: mapParams.title,
         config: _getMapConfig(mapParams.venue),
       };

       // apply is_selected flag and update c.wsdMappedinReservationData
       c.floorReservables = reservableUnits.map(c.reservableMapper);
       _evaluateSelectionAndUpdateFeedback({
         origin: "navigation",
       });
     })
     ["catch"](function (err) {
       console.warn("wsdMappedinService error", err);
       var errorMsg =
         "${An error has occurred while loading the map view. Please try again}";
       _showNotification(
         true,
         errorMsg,
         "alert-danger",
         "fa-exclamation-triangle"
       );
     });
 }

 /**
  * Get default popup config object for unreservable spaces
  * @param {Object} polygonDetails - Details of the clicked polygon - name, description, type, id.
  * @return {{popupTemplate: string, popupVariables: object}} - default popupTemplate and popupVariables
  */
 function getDefaultPopupConfig(polygonDetails) {
   return new Promise(function (resolve, reject) {
     resolve({
       popupTemplate: "tooltip",
       popupVariables: {
         name: polygonDetails.name,
         description: polygonDetails.description,
         space_type: polygonDetails.type,
         message: "Not Reservable",
       },
     });
   });
 }

 /**
  * On click return the configuration needed to instance a popup
  * @param {string} spaceSysId - sys_id of the selected space
  * @param {Object} spaceDetails - details of the space such as region, site, campus, location_type
  * @param {Object} polygonDetails - details of the polygon such as name, description, type, id.
  * @return {{popupTemplate: string, popupVariables: object}} - popup template and scope
  */
 function onMapSpaceSelect(spaceSysId, spaceDetails, polygonDetails) {
   var selectedSpace = c.floorReservables.find(function (reservable) {
     return reservable.sys_id === spaceSysId;
   });
   // use default template for unreservables
   if (!selectedSpace) return getDefaultPopupConfig(polygonDetails);
   // populate custom template
   var extras = c.data.showReservationDetails
     ? selectedSpace.reservations.map(function (res) {
         return {
           label: res.requested_for.name,
           icon: "fa-user",
           value: res.requested_for.name,
         };
       })
     : [];
   return new Promise(function (resolve, reject) {
     resolve({
       popupTemplate: "popupcard",
       popupVariables: {
         space: selectedSpace,
         extras: extras,
         ctrl: c,
       },
     });
   });
 }

 /**
  * Generate data object used by <wsd-mappedin-map>'s floor selector
  * @param {Array} - list of floors
  * @return {object} - floor options for floor list box
  */
 function _generateFloorSelectorData(floorSelectorData) {
   var selectedSpacesPerFloor = c.selectedItems.reduce(function (
     selectedSpaces,
     selectedItem
   ) {
     var floorId = selectedItem.floor_sys_id || selectedItem.floor.sys_id;
     selectedSpaces[floorId] = (selectedSpaces[floorId] || 0) + 1;
     return selectedSpaces;
   },
   {});

   var mapFloorOptions = floorSelectorData.map(function (floorOption) {
     var displayValueModifier = selectedSpacesPerFloor[floorOption.sys_id]
       ? " (" + selectedSpacesPerFloor[floorOption.sys_id] + ")"
       : "";
     // keep unmodified floor name for future updates
     if (!floorOption.hasOwnProperty("original_display_value"))
       floorOption.original_display_value = floorOption.display_value;
     return {
       sys_id: floorOption.sys_id,
       display_value:
         floorOption.original_display_value + displayValueModifier,
       original_display_value: floorOption.original_display_value,
     };
   });

   return mapFloorOptions;
 }

 /**
  * Check current reservable module show_map_view field to hide or show
  * the map view button. Should be run after search occurs.
  * @private
  */
 function _checkShowMapView() {
   if (!c.data.isMappedinInstalled) return;

   var reservableModule = wsdStateService.getState("selectedReservableModule");
   if (reservableModule === null) return;
   var showMapView =
     reservableModule.show_map_view && !reservableModule.apply_to_shift;

   c.viewOptions = VIEW_OPTIONS.filter(function (option) {
     return option.type !== "map" || showMapView;
   });

   if (!showMapView && c.activeView.type === "map")
     toggleViewOption(c.viewOptions[0], true);
 }

 /**
  * Get map config using wsdMappedinMapConfigService. The dependency gets added if mappedin is installed.
  * @return {Object} - Configurations which are required to initialize the map.
  */
 function _getMapConfig(venueSlug) {
   var config = {};
   if (c.data.isMappedinInstalled) {
     try {
       var injector = angular.element(document.body).injector();
       config = injector
         .get("wsdMappedinMapConfigService")
         .getConfig(venueSlug);
     } catch (err) {
       console.warn("wsdMappedinMapConfigService error", err);
       var errorMsg =
         "${An error has occurred while loading the map. Please try again}";
       _showNotification(
         true,
         errorMsg,
         "alert-danger",
         "fa-exclamation-triangle"
       );
     }
   }
   return config;
 }

 /**
  * Get map legends using wsdMapLegendService. The dependency gets added if mappedin is installed.
  * @return {Array} - Array of legends to display on map.
  */
 function _getMapLegend() {
   var legends = [];
   if (c.data.isMappedinInstalled) {
     try {
       var injector = angular.element(document.body).injector();
       legends = injector.get("wsdMapLegendService").bookingLegends;
     } catch (err) {
       console.warn("wsdMapLegendService error", err);
       var errorMsg =
         "${An error has occurred while loading the map. Please try again}";
       _showNotification(
         true,
         errorMsg,
         "alert-danger",
         "fa-exclamation-triangle"
       );
     }
   }
   return legends;
 }
};

/**
* @typedef Reservable - (copy from server's reponse object)
* @property {number} capacity - Capacity of the reservable.
* @property {number} number_of_attendees - Amount of attendees.
* @property {string} sys_id - Sys_id of the reservable.
* @property {string} name - Name of the reservable.
* @property {string} description - Description of the reservable.
* @property {string} display_value - Display value of the reservable
* @property {ReferenceField || null} area - Area of the reservable.
* @property {ReferenceField || null} building - Building of the reservable.
* @property {ReferenceField || null} campus - Campus of the reservable.
* @property {ReferenceField || null} floor - Floor of the reservable.
* @property {ReferenceField || null} region - Region of the reservable.
* @property {ReferenceField || null} site - Site of the reservable.
* @property {StandardService[]} standard_services - List of standard services of the reservable.
*/

/**
* @typedef SortByOption
* @property {string} id - value of the select option
* @property {string} text - text to display in the select option
* @property {string} icon - icon to display next to the text in the select option
*/

/**
* Represents details about the event that caused a change to the basket
* (e.g. appending, removing, toggling, etc.)
* @typedef {object} EventDetails
* @property {string} origin - the "source" of the event
*
* Origin can be...
*   'interactive': user explicitly selected or deselected a reservable
*   'landing': user landed on the page (e.g. when editing an existing reservation), and when reservable changes
*   'validation': a filter change caused a deselection (item is no longer available)
* - 'navigation': user navigated to new "page" of data (e.g. switching floors in the map)
*/

/** WSD Search client  */
