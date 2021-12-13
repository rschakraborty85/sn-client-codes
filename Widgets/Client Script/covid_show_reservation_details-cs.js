api.controller = function ($scope, $uibModalStack, spUtil) {
  /* widget controller */
  var c = this;

  var elems = document.getElementsByClassName("modal-body");
  Array.prototype.filter.call(elems, function (testElement) {
    testElement.style.padding = "0px";
  });

  $scope.closemodal = function () {
    $scope.$parent.$parent.buttonClicked({ label: "Cancel", cancel: true });
    $uibModalStack.dismissAll();
  };

  var q = "health_and_safety_user.userDYNAMIC90d1921e5f510100a9ad2572f2b477fe";
  spUtil.recordWatch(
    $scope,
    "sn_imt_core_employee_health_and_safety_requirement",
    q,
    function (event, data) {
      spUtil.update($scope);
    }
  );
};
