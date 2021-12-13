api.controller = function ($rootScope, $timeout) {
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
    if (c.data.records) {
      var todayRequests = c.data.records.filter(function (req) {
        // get only date and not time
        var startDate = req.start.toString().split(" ")[0];
        // return req.start == c.data.today;
        // @note - compare reservation and user date both in local tz
        return startDate == c.data.today;
      });
    }

    if (todayRequests && todayRequests.length > 0) {
      // @note RC - STRY2462915 - dont run for mobile
      if (!c.data.mobile)
        $timeout(function () {
          c.markAsSelected(todayRequests[0], c.data.records);
        }, 1500);
      // c.markAsSelected(todayRequests[0], c.data.records);
    }
  }

  function maybeUnselectRow(items, clickedItemSysId) {
    var selected = items.filter(function (item) {
      return item.isSelected;
    });
    if (
      selected &&
      selected.length > 0 &&
      selected[0].sys_id === clickedItemSysId
    ) {
      return;
    } else if (selected && selected.length > 0) {
      selected[0].isSelected = false;
    }
  }

  c.markAsSelected = function (item, items) {
    maybeUnselectRow(items, item.sys_id);
    item.isSelected = !item.isSelected;
    // console.log("RC item " + JSON.stringify(item));
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
