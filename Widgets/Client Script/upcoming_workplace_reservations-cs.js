function($rootScope) {
    var c = this;		
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
	
	function isReservationOrTravelRequestForToday() {
		var todayRequests = c.data.records.filter(function(req) { return req.start == c.data.today });
		if (todayRequests && todayRequests.length > 0) {
			c.markAsSelected(todayRequests[0], c.data.records);	
		} 
	}
	
	function maybeUnselectRow(items, clickedItemSysId) {
		var selected = items.filter(function(item) { return item.isSelected;});	
		if (selected && selected.length > 0 && selected[0].sys_id === clickedItemSysId) {
			return;
		}
		else if (selected && selected.length > 0) {
			selected[0].isSelected = false;
		}
	}
	
	c.markAsSelected = function(item, items) {
		maybeUnselectRow(items, item.sys_id);
		item.isSelected = !item.isSelected;
		$rootScope.$broadcast('onTravelOrReservationSelected', item);
	}
    
	$rootScope.$on('getReservations', function(event, data) {
		c.server.get({
			action: 'user',
			user_type: data.user_type,
			user: data.user
		}).then(function(response) {
			c.data = response.data;			
			isReservationOrTravelRequestForToday();
		});
	});
	
	var presentEvent = c.data.records
		.filter(function (r) { return r.present; })
		[0];
	
	if (presentEvent) {
		c.markAsSelected(presentEvent, c.data.records);
	}
	
	isReservationOrTravelRequestForToday();
}