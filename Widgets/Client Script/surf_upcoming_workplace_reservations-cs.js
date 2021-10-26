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
    //     JSON.stringify(c.data)
    // );
    var todayRequests = c.data.records.filter(function (req) {
      // console.log("RC todayRequests " + req.start + "-\t-" + c.data.today);
      // get only date and not time
      var startDate = req.start.toString().split(" ")[0];
      // return req.start == c.data.today;
      return startDate == c.data.today;
    });
    // console.log("RC today2 " + todayRequests);
    if (todayRequests && todayRequests.length > 0) {
      c.markAsSelected(todayRequests[0], c.data.records);
    }
  }

  function maybeUnselectRow(items, clickedItemSysId) {
    //console.log("RC maybeUnselectRow items " + JSON.stringify(items));
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
    // console.log("RC markAsSelected item " + JSON.stringify(item));
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
        // console.log("RC reservation data " + JSON.stringify(c.data));
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
