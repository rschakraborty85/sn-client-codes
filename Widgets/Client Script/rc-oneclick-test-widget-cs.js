api.controller = function (wsdReservableSearch) {
  try {
    var c = this;
    var STATIC_JSON_INDI = {
      mode: null,
      reservable_module: "9c9bff98db6f2c10ae466c8e139619a0",
      building: "7d3bafaedb2614500adbc4be139619b0",
      start: "2021-08-02T02:30:00Z",
      end: "2021-08-02T12:30:00Z",
      next_item_index: null,
      page_size: 8,
      include_unavailable_items: false,
      include_reservations_within_days: false,
      include_standard_services: true,
      include_reservable_purposes: true,
      sort_by: "a_z",
    };
    var STATIC_JSON_AREA = {
      mode: null,
      reservable_module: "e4abf3dcdbaf2c10ae466c8e13961925",
      building: "a13bafaedb2614500adbc4be13961988",
      start: "2021-08-02T02:30:00Z",
      end: "2021-08-02T12:30:00Z",
      next_item_index: null,
      page_size: 8,
      include_unavailable_items: false,
      include_reservations_within_days: false,
      include_standard_services: true,
      include_reservable_purposes: true,
      sort_by: "a_z",
    };

    wsdReservableSearch
      .getAvailableReservables(STATIC_JSON_INDI)
      .then(function (response) {
        console.log("RC one click result is " + JSON.stringify(response));
      });
  } catch (error) {
    console.log("RC " + error);
  }
};
