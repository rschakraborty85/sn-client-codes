api.controller = function ($scope, $uibModal, $window) {
  /* widget controller */
  var c = this;

  c.loadData = function (type, cancelRequest) {
    if (type == "myreservation") {
      c.selfReservation = "MyReservation";
      var actionData = {
        action: "myreservation",
      };
      if (cancelRequest) actionData.cancelRequest = cancelRequest;
      c.showLoading = true;
      c.server.get(actionData).then(function (r) {
        c.data.myReservationList = r.data.myReservationList;
        c.showLoading = false;
      });
    }
  };

  c.cancelReservation = function (cancelRequest) {
    c.cancelRequest = cancelRequest;
    c.modalInstance = $uibModal.open({
      templateUrl: "cancelReservationConfirmation2",
      scope: $scope,
      backdrop: "static",
      windowClass: "iamSmallModal",
      size: "lg",
    });
  };

  c.closeModal = function (cancelRequest) {
    if (cancelRequest) c.loadData("myreservation", c.cancelRequest);
    c.modalInstance.close();
  };

  c.goToMyReservation = function () {
    var actionData = { action: "goToMyReservation" };
    c.server.get(actionData).then(function (r) {
      c.mobile_link = r.data.mobile_link;
      if (c.mobile_link != "") {
        $window.location.href = c.mobile_link;
      } else {
        alert(
          "Error while redirection. Please access My Reservations tab from main app"
        );
      }
    });
  };

  c.goToMyShifts = function () {
    var actionData = { action: "goToMyShifts" };
    c.server.get(actionData).then(function (r) {
      c.mobile_link = r.data.mobile_link;
      if (c.mobile_link != "") {
        $window.location.href = c.mobile_link;
      } else {
        alert(
          "Error while redirection. Please access My Shifts tab from main app"
        );
      }
    });
  };

  /*
    c.loadMore = function() {
        c.fetching = true;
        c.server.get({
            action: 'fetch_more',
            lastLimit: c.data.lastLimit,
            user_type: c.data.user_type,
            user: c.data.user
        }).then(function(response) {
            c.data = response.data;
            c.fetching = false;
        });
    }
    
    $rootScope.$on('getReservations', function(event, data) {
        c.server.get({
            action: 'user',
            user_type: data.user_type,
            user: data.user
        }).then(function(response) {
            c.data = response.data;
        });
    });*/

  //c.data.myReservationList = c.data.myReservationList;
};
