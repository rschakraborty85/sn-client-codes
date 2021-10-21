api.controller = function ($rootScope) {
  var c = this;
  c.loadMore = function () {
    c.fetching = true;
    c.server
      .get({
        action: "fetch_more",
        lastLimit: c.data.lastLimit,
        user_type: c.data.user_type,
        user: c.data.user,
      })
      .then(function (response) {
        c.data = response.data;
        c.fetching = false;
      });
  };

  function isReservationOrTravelRequestForToday() {
    // console.log(
    //   "RC function isReservationOrTravelRequestForToday data is\n" +
    //     // JSON.stringify(c.data.records)
    //     // +
    //     // "\n" +
    //     JSON.stringify(c.data)
    // );
    var todayRequests = c.data.records.filter(function (req) {
      //   console.log("RC today " + req.start + "\t" + c.data.today);
      return req.start == c.data.today;
    });
    // console.log("RC today " + todayRequests);
    if (todayRequests && todayRequests.length > 0) {
      c.markAsSelected(todayRequests[0], c.data.records);
    }
  }

  function maybeUnselectRow(items, clickedItemSysId) {
    var selected = items.filter(function (item) {
      // @note - get selected row
      return item.isSelected;
    });
    if (
      selected &&
      selected.length > 0 &&
      selected[0].sys_id === clickedItemSysId
    ) {
      // @note when you select / unselect same row
      // $rootScope.$broadcast("onTravelOrReservationSelected", "");
      return;
    } else if (selected && selected.length > 0) {
      // @note when you select another row

      selected[0].isSelected = false;
    }
  }

  c.markAsSelected = function (item, items) {
    // console.log("did i call mark as selected on selection of employee");
    maybeUnselectRow(items, item.sys_id);
    item.isSelected = !item.isSelected;
    //console.log("RC item is " + JSON.stringify(item));
    $rootScope.$broadcast("onTravelOrReservationSelected", item);
  };

  $rootScope.$on("getReservations", function (event, data) {
    c.server
      .get({
        action: "user",
        user_type: data.user_type,
        user: data.user,
      })
      .then(function (response) {
        c.data = response.data;
        // @note isReservationOrTravelRequestForToday never works on load for us , always on server callback
        isReservationOrTravelRequestForToday();
      });
  });

  var presentEvent = c.data.records.filter(function (r) {
    // console.log("RC present event R is " + JSON.stringify(r));
    return r.present;
  })[0];

  if (presentEvent) {
    c.markAsSelected(presentEvent, c.data.records);
  }

  isReservationOrTravelRequestForToday();
};
