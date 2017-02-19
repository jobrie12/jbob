angular
    .module('FantasyFootballTools',['mgcrea.ngStrap','ui.router'])
    .config([
        '$stateProvider',
        '$urlRouterProvider',
        function($stateProvider, $urlRouterProvider) {

            var draftState = {
                name: 'draft',
                url: '/draft',
                templateUrl: 'templates/draft.tpl.html',
                controller: 'draftCtrl'
            };

            var cribbageState = {
                name: 'cribbage',
                url: '/cribbage',
                templateUrl: 'templates/cribbage.tpl.html',
                controller: 'cribbageCtrl'
            };

            var cardsharksState = {
                name: 'cardsharks',
                url: '/cardsharks',
                templateUrl: 'templates/cardsharks.tpl.html',
                controller: 'cardsharksCtrl'
            };

            var postsState = {
                name: 'postsHome',
                url: '/posts',
                templateUrl: 'templates/postsHome.tpl.html',
                controller: 'postsHomeCtrl',
                resolve: {
                    postPromise: ['posts', function(posts){
                        return posts.getAll();
                    }]
                }
            };

            $stateProvider.state(draftState);
            $stateProvider.state(cribbageState);
            $stateProvider.state(cardsharksState);
            $stateProvider.state(postsState)
                .state('posts', {
                    url: '/posts/{id}',
                    templateUrl: 'templates/posts.tpl.html',
                    controller: 'postsCtrl',
                    resolve: {
                        post: ['$stateParams', 'posts', function($stateParams, posts) {
                            return posts.get($stateParams.id);
                        }]
                    }
                }).state('login', {
                url: '/login',
                templateUrl: 'templates/login.tpl.html',
                controller: 'AuthCtrl',
                onEnter: ['$state', 'auth', function($state, auth){
                    if(auth.isLoggedIn()){
                        $state.go('draft');
                    }
                }]
            })
                .state('register', {
                    url: '/register',
                    templateUrl: 'templates/register.tpl.html',
                    controller: 'AuthCtrl',
                    onEnter: ['$state', 'auth', function($state, auth){
                        if(auth.isLoggedIn()){
                            $state.go('draft');
                        }
                    }]
                });

            $urlRouterProvider.otherwise('draft');
        }])
    .factory('posts', ['$http', 'auth', function($http, auth){
        var o = {
            posts: []
        };

        o.getAll = function() {
            return $http.get('/posts').success(function(data){
                angular.copy(data, o.posts);
            });
        };

        o.get = function(id) {
            return $http.get('/posts/' + id).then(function(res){
                return res.data;
            });
        };

        o.create = function(post) {
            return $http.post('/posts', post, {
                headers: {Authorization: 'Bearer '+auth.getToken()}
            }).success(function(data){
                o.posts.push(data);
            });
        };

        o.upvote = function(post) {
            return $http.put('/posts/' + post._id + '/upvote', null, {
                headers: {Authorization: 'Bearer '+auth.getToken()}
            }).success(function(data){
                post.upvotes += 1;
            });
        };

        o.addComment = function(id, comment) {
            return $http.post('/posts/' + id + '/comments', comment, {
                headers: {Authorization: 'Bearer '+auth.getToken()}
            });
        };

        o.upvoteComment = function(post, comment) {
            return $http.put('/posts/' + post._id + '/comments/'+ comment._id + '/upvote', null, {
                headers: {Authorization: 'Bearer '+auth.getToken()}
            }).success(function(data){
                comment.upvotes += 1;
            });
        };

        return o;
    }])
    .factory('auth', ['$http', '$window', function($http, $window){
        var auth = {};

        auth.saveToken = function (token){
            $window.localStorage['bryantobrien-token'] = token;
        };

        auth.getToken = function (){
            return $window.localStorage['bryantobrien-token'];
        };

        auth.isLoggedIn = function(){
            var token = auth.getToken();

            if(token){
                var payload = JSON.parse($window.atob(token.split('.')[1]));

                return payload.exp > Date.now() / 1000;
            } else {
                return false;
            }
        };

        auth.logIn = function(user){
            return $http.post('/login', user).success(function(data){
                auth.saveToken(data.token);
            });
        };

        auth.logOut = function(){
            $window.localStorage.removeItem('bryantobrien-token');
        };

        auth.currentUser = function(){
            if(auth.isLoggedIn()){
                var token = auth.getToken();
                var payload = JSON.parse($window.atob(token.split('.')[1]));

                return payload.username;
            }
        };

        auth.register = function(user){
            return $http.post('/register', user).success(function(data){
                auth.saveToken(data.token);
            });
        };

        return auth;
    }])
    .controller('AuthCtrl', [
        '$scope',
        '$state',
        'auth',
        function($scope, $state, auth){
            $scope.user = {};

            $scope.register = function(){
                auth.register($scope.user).error(function(error){
                    $scope.error = error;
                }).then(function(){
                    $state.go('draft');
                });
            };

            $scope.logIn = function(){
                auth.logIn($scope.user).error(function(error){
                    $scope.error = error;
                }).then(function(){
                    $state.go('draft');
                });
            };
        }])
    .controller('NavCtrl', [
        '$scope',
        'auth',
        function($scope, auth){
            $scope.isLoggedIn = auth.isLoggedIn;
            $scope.currentUser = auth.currentUser;
            $scope.logOut = auth.logOut;
        }])
    .controller('draftCtrl',function($scope, LoadPlayersService, $modal, $http,  $log){
        var init = function(){

            $scope.players = [];
            $scope.keepers = [];
            $scope.showDraftBoard = false;
            $scope.keeperTime = true;
            $scope.draftOver = false;
            $scope.draftTime = false;
            $scope.selPlayer=null;
            $scope.selField=null;
            $scope.manName = null;
            $scope.config = null;
            LoadPlayersService.fetch().then(function(data) {
                $scope.players= data.players;
                $scope.players.each(function(n){
                    n.available = true;
                })
                if (data.configOptions){
                    $scope.configOptions = data.configOptions;
                }
            })

            $scope.colorScale= {
                QB:"#a3c8ff",
                RB:"#a3ff8c",
                WR:"red",
                TE:"orange",
                K:'purple',
                DST:'pink'
            }

            $scope.teams = {number:10, teams:[]};
            $scope.rounds = {number:16, rounds:[]};
            $scope.filters = ['All','QB','RB','WR','TE','K','DST'];
            $scope.filter = 'All';
            $scope.strategies = ['BVN','Equal']
            $scope.strategy = 'Equal';

            $scope.editNameModal = $modal({scope: $scope, template: 'templates/modals/editNameModal.tpl.html', show: false});
        }

        $scope.changeName = function(team) {
            $scope.teamData = team;
            $scope.editNameModal.$promise.then($scope.editNameModal.show);
        };

        $scope.loadConfig = function(config){
            $scope.config = config;
        }

        $scope.createBoard = function(){
            if ($scope.config){
                $scope.teams = $scope.config.config.teams;
                $scope.rounds = $scope.config.config.rounds;
            }
            if ($scope.teams.teamNames){
                for (var i = 1; i <= $scope.teams.number ; i++){
                    $scope.teams.teams.push({name:$scope.teams.teamNames[i-1],number:i,picks:{},players:[]});
                }
            }else {
                for (var i = 1; i <= $scope.teams.number ; i++){
                    $scope.teams.teams.push({name:'Team '+i,number:i,picks:{},players:[]});
                }
            }
            for (var i = 1; i <= $scope.rounds.number ; i++){
                $scope.rounds.rounds.push({number:i,picks:{}});
            }

            $scope.showDraftBoard = true;
            if ($scope.config){
                if ($scope.config.config.keepers){
                    $scope.keepers = $scope.config.config.keepers;
                    $scope.addKeepers();
                }
            }
            $scope.keeperTime = true;
        }

        $scope.selectField = function(round,team){
            $scope.selField = {round:round.number, team:team.number, name:team.name};
        }

        $scope.selectPlayer = function(player){
            $scope.selPlayer = player;
        }

        $scope.setFilter = function(filter){
            $scope.filter = filter;
        }

        $scope.startDraft = function(){
            $scope.draftTime= true;
            $scope.keeperTime = false;

            $scope.selField = $scope.nextOnTheClock();
        }

        $scope.draftPlayer = function(){
            $scope.addKeeper();
            $scope.selField = $scope.nextOnTheClock();
        }

        $scope.submitMan = function(){
            var man = {
                "name":$scope.manName,
                "pos":"MANUAL",
                "bw":25,
                "tm":"MAN"
            };
            console.log($scope.players);
            $scope.players.push(man);
            $scope.selPlayer = man;
            $scope.addKeeper();
            $scope.selField = $scope.nextOnTheClock();
            $scope.manName = "";
        }

        $scope.simPick = function(){
            $scope.findBestPlayer($scope.selField.round,$scope.selField.team);
            $scope.selField = $scope.nextOnTheClock();
        }

        $scope.recPick = function(){
            $scope.findBestPlayer($scope.selField.round, $scope.selField.team,true);
        }

        $scope.nextOnTheClock = function(){
            $scope.selPlayer = null;
            $scope.selField = null;
            for (var i = 1; i <= $scope.rounds.number ; i++){
                if (i%2 == 0){
                    for (var j = $scope.teams.number;j>0;j--){
                        if ($scope.rounds.rounds[i-1].picks[j]){
                        } else {
                            var field = {round:i, team:j, name:$scope.teams.teams[j-1].name};
                            return field;
                        }
                    }
                } else {
                    for (var j = 1;j<=$scope.teams.number;j++){
                        if ($scope.rounds.rounds[i-1].picks[j]){
                        } else{
                            var field = {round:i, team:j, name:$scope.teams.teams[j-1].name};
                            return field;
                        }
                    }
                }
            }
            $scope.draftOver = true;
            $scope.draftTime = false;
        }

        $scope.simDraft = function(){
            $scope.keeperTime = false;
            $scope.selPlayer = null;
            $scope.selField = null;
            for (var i = 1; i <= $scope.rounds.number ; i++){
                if (i%2 == 0){
                    for (var j = $scope.teams.number;j>0;j--){
                        $scope.findBestPlayer(i,j);
                    }
                } else {
                    for (var j = 1;j<=$scope.teams.number;j++){
                        $scope.findBestPlayer(i,j);
                    }
                }
            }
            $scope.draftOver = true;
            $scope.draftTime = false;
        }

        $scope.findBestPlayer = function(round,team,noadd){
            if ($scope.rounds.rounds[round-1].picks[team]){
                $scope.selPlayer = null;
                $scope.selField = null;
            } else {
                $scope.selField = {round:round, team:team, name:$scope.teams.teams[team-1].name};
                var k = 0;
                var fullteam = $scope.teams.teams[team-1];
                while ($scope.selPlayer == null){
                    if ($scope.players[k].available == true){
                        var player = $scope.players[k];
                        if ($scope.starter(player,fullteam,k) == true){
                            $scope.selPlayer = player;
                        } else {
                            console.log("Passed on " + player.name);
                        }
                    }
                    k++;
                }
                if (!noadd){
                    $scope.addKeeper();
                }
            }
        }

        $scope.addKeeper = function(){
            $scope.selPlayer.round = $scope.selField.round;
            $scope.selPlayer.team = $scope.selField.name;
            var team = $scope.teams.teams[$scope.selField.team - 1];
            team.picks[$scope.selField.round] = $scope.selPlayer;
            team.players.push($scope.selPlayer);
            $scope.rounds.rounds[$scope.selField.round - 1].picks[$scope.selField.team] = $scope.selPlayer;
            $scope.selPlayer.available = false;
            $scope.selPlayer = null;
            $scope.selField = null;

            $scope.buildRoster(team);

        }

        $scope.buildRoster = function(team){
            var starters = {
                QB:0,
                RB:0,
                WR:0,
                TE:0,
                FLEX:0,
                K:0,
                DST:0,
                BENCH:0
            };

            var cap = {
                QB:1,
                RB:2,
                WR:2,
                TE:1,
                FLEX:2,
                K:1,
                DST:1,
                BENCH:6
            };

            team.roster = {QB:[],RB:[],WR:[],TE:[],FLEX:[],K:[],DST:[],BENCH:[]};
            team.players.each(function(n){
                if (starters[n.pos] >= cap[n.pos]){
                    if (['RB','WR','TE'].indexOf(n.pos) > -1){
                        if (starters.FLEX == cap.FLEX){
                            starters['BENCH']++;
                            team.roster.BENCH.push(n);
                        } else {
                            starters['FLEX']++;
                            team.roster.FLEX.push(n);
                        }
                    } else {
                        starters['BENCH']++;
                        team.roster.BENCH.push(n);
                    }
                } else {
                    starters[n.pos]++;
                    team.roster[n.pos].push(n);
                }
            });

            while (team.roster.QB.length<cap.QB){
                team.roster.QB.push({name:""});
            }
            while (team.roster.RB.length<cap.RB){
                team.roster.RB.push({name:""});
            }
            while (team.roster.WR.length<cap.WR){
                team.roster.WR.push({name:""});
            }
            while (team.roster.TE.length<cap.TE){
                team.roster.TE.push({name:""});
            }
            while (team.roster.FLEX.length<cap.FLEX){
                team.roster.FLEX.push({name:""});
            }
            while (team.roster.K.length<cap.K){
                team.roster.K.push({name:""});
            }
            while (team.roster.DST.length<cap.DST){
                team.roster.DST.push({name:""});
            }
            while (team.roster.BENCH.length<cap.BENCH){
                team.roster.BENCH.push({name:""});
            }
        }

        $scope.addKeepers = function(){
            for (var i = 0; i < $scope.keepers.length; i++){
                var keep = $scope.keepers[i];
                $scope.selField = {round:keep.round_num, team:keep.team_num, name:$scope.teams.teams[keep.team_num-1].name}
                var player = $scope.players.filter(function(player){
                    return player.name.indexOf(keep.player) != -1;
                });
                $scope.selPlayer = player[0];
                $scope.addKeeper();
            }
        }

        $scope.starter = function(player, team, index){
            var starters = {
                QB:0,
                RB:0,
                WR:0,
                TE:0,
                FLEX:0,
                K:0,
                DST:0,
                BENCH:0
            };
            var count = {
                QB:0,
                RB:0,
                WR:0,
                TE:0,
                K:0,
                DST:0
            };
            var cap = {
                QB:1,
                RB:2,
                WR:2,
                TE:1,
                FLEX:2,
                K:1,
                DST:1,
                BENCH:6
            };

            var max = {
                QB:2,
                RB:5,
                WR:7,
                TE:2,
                K:1,
                DST:1
            }

            var i = 0;
            team.roster = {QB:[],RB:[],WR:[],TE:[],FLEX:[],K:[],DST:[],BENCH:[]};
            team.players.each(function(n){
                count[n.pos]++;
                if (starters[n.pos] >= cap[n.pos]){
                    if (['RB','WR','TE'].indexOf(n.pos) > -1){
                        if (starters.FLEX == cap.FLEX){
                            starters['BENCH']++;
                            team.roster.BENCH.push(n);
                        } else {
                            starters['FLEX']++;
                            team.roster.FLEX.push(n);
                        }
                    } else {
                        starters['BENCH']++;
                        team.roster.BENCH.push(n);
                    }
                } else {
                    starters[n.pos]++;
                    team.roster[n.pos].push(n);
                }
                i++;
            });

            if (count[player.pos] >=max[player.pos]){return false;}

            if (team && $scope.strategy == 'BVN'){


                if (starters[player.pos] >= cap[player.pos]){
                    if (['RB','WR','TE'].indexOf(player.pos) > -1){
                        if (starters['FLEX']<cap['FLEX']){
                            team.roster.FLEX.push(player);
                            return true;
                        } else if (i < $scope.rounds.number - 2 + starters['K'] + starters['DST']){
                            team.roster.BENCH.push(player);
                            return true;
                        } else return false;
                    } else if (player.pos == 'QB'){
                        if (count['QB'] == 1 && i > 7 && i < $scope.rounds.number - 2 + starters['K'] + starters['DST']){
                            team.roster.BENCH.push(player);
                            return true;
                        } else return false;
                    } else {
                        console.log(player.pos);
                        return false;
                    }
                } else {
                    team.roster[player.pos].push(player);
                    return true;
                }
            } else if ($scope.strategy == 'Equal'){
                if (player.pos == 'RB'){
                    var WRDiff = (count['RB'] - count['WR']) * .25;
                    if (WRDiff > 0){
                        var dex = index + 1;
                        var nextPlayer = $scope.players[dex];
                        while (nextPlayer.val > (player.val - WRDiff)){
                            console.log(nextPlayer.val + " >? " + (player.val - WRDiff));
                            if (nextPlayer.pos['WR'] && nextPlayer.available){
                                return false;
                            } else {
                                dex = dex + 1;
                                nextPlayer = $scope.players[dex];
                                console.log(dex + " player: " + nextPlayer.name);
                            }
                        }
                        return true;
                    } return true;
                } else if (player.pos == 'WR'){
                    var RBDiff = (count['WR'] - count['RB']) * .25;
                    if (RBDiff > 0){
                        var dex = index + 1;
                        var nextPlayer = $scope.players[dex];
                        while (nextPlayer.val > (player.val - RBDiff)){
                            console.log(nextPlayer.val + " >? " + (player.val - RBDiff));
                            if (nextPlayer.pos['RB'] && nextPlayer.available){
                                return false;
                            } else {
                                dex = dex + 1;
                                nextPlayer = $scope.players[dex];
                                console.log(dex + " player: " + nextPlayer.name);
                            }
                        }
                        return true;
                    } return true;
                } else if (starters[player.pos] >= cap[player.pos]){
                    if (['RB','WR','TE'].indexOf(player.pos) > -1){
                        if (starters['FLEX']<cap['FLEX']){
                            team.roster.FLEX.push(player);
                            return true;
                        } else if (i < $scope.rounds.number - 2 + starters['K'] + starters['DST']){
                            team.roster.BENCH.push(player);
                            return true;
                        } else return false;
                    } else if (player.pos == 'QB'){
                        if (count['QB'] == 1 && i > 7 && i < $scope.rounds.number - 2 + starters['K'] + starters['DST']){
                            team.roster.BENCH.push(player);
                            return true;
                        } else return false;
                    } else {
                        console.log(player.pos);
                        return false;
                    }
                } else {
                    team.roster[player.pos].push(player);
                    return true;
                }
            } else {return false;}
        }

        $scope.resetDraft = function(){
            init();
        }

        $scope.showPlayers = function(){
            this.show= !this.show;
            console.log($scope.showFilters);
        }

        init();
    })
    .controller('cardsharksCtrl', function($scope){
        function init(){
            $scope.cardConfiguration = {
                "suits":[
                    {
                        "name":"Hearts",
                        "symbol":" &hearts;",
                        "color":"red"
                    },
                    {
                        "name":"Diamonds",
                        "symbol":" &diams;",
                        "color":"red"
                    },
                    {
                        "name":"Spades",
                        "symbol":" &spades;",
                        "color":"black"
                    },
                    {
                        "name":"Clubs",
                        "symbol":" &clubs;",
                        "color":"black"
                    }
                ],
                "values":[
                    {
                        "name": "Two",
                        "symbol":"2",
                        "value": 2
                    },
                    {
                        "name": "Three",
                        "symbol":"3",
                        "value": 3
                    },
                    {
                        "name": "Four",
                        "symbol":"4",
                        "value": 4
                    },
                    {
                        "name": "Five",
                        "symbol":"5",
                        "value": 5
                    },
                    {
                        "name": "Six",
                        "symbol":"6",
                        "value": 6
                    },
                    {
                        "name": "Seven",
                        "symbol":"7",
                        "value": 7
                    },
                    {
                        "name": "Eight",
                        "symbol":"8",
                        "value": 8
                    },
                    {
                        "name": "Nine",
                        "symbol":"9",
                        "value": 9
                    },
                    {
                        "name": "Ten",
                        "symbol":"10",
                        "value": 10
                    },
                    {
                        "name": "Jack",
                        "symbol":"J",
                        "value": 11
                    },
                    {
                        "name": "Queen",
                        "symbol":"Q",
                        "value": 12
                    },
                    {
                        "name": "King",
                        "symbol":"K",
                        "value": 13
                    },
                    {
                        "name": "Ace",
                        "symbol":"A",
                        "value": 14
                    }
                ]
            };

            $scope.ties = [
                {
                    point:1,
                    twoKPay : 10,
                    acePay: 40
                },
                {
                    point:2,
                    twoKPay : 5,
                    acePay: 20
                },
                {
                    point:3,
                    twoKPay : 4,
                    acePay: 10
                },
                {
                    point:4,
                    twoKPay : 3,
                    acePay: 6
                },
                {
                    point:5,
                    twoKPay : 2,
                    acePay: 4
                },
                {
                    point:6,
                    twoKPay : 1,
                    acePay: 2
                }
            ];

            $scope.wins = [
                {
                    point:'0-2 Correct Guesses',
                    win: '0',
                    val:0
                },
                {
                    point:'3-5 Correct Guesses',
                    win: '1 to 1',
                    val:1
                },
                {
                    point:'6 Correct Guesses',
                    win: '3 to 1',
                    val:3
                }
            ];

            $scope.deckSizes = [4, 6, 8];
            $scope.deckSize = 4;

            $scope.bet = {
                wager:0,
                tie:0
            }

            $scope.newGame();

            /* Phases of the Game:
             * Pick Deck Size and Shuffle
             * Wager And Side Bet
             * Accept or Next
             * Flip Starter Card
             * Non-Dealer plays First
             * Alternate Plays
             *
             * */


        }

        $scope.newGame = function() {
            $scope.phase = "New Game";
            $scope.gameOver = false;
            $scope.card = null;
            $scope.prevCard = null;
            $scope.message = null;
            $scope.correct = 0;
        };

        $scope.startGame = function() {
            $scope.phase = "Start Game";
            $scope.buildDeck();
        }

        $scope.playGame = function(play) {
            $scope.message = null;
            if (($scope.correct == 0) && !play){
                $scope.card = dealCard();
                $scope.phase = "Play or Switch"
            } else {
                $scope.phase = "Play Game";
            }
        }

        $scope.switch = function(){
            $scope.card = dealCard();
            $scope.playGame(true);
        }

        $scope.reveal = function(high){
            $scope.prevCard = $scope.card
            $scope.card = dealCard();

            if (high){
                $scope.message = "You Picked Higher,"
            } else {
                $scope.message = "You Picked Lower,"
            }

            if ($scope.card.value == $scope.prevCard.value){
                $scope.gameOver = true;
                $scope.message += " but it's a Tie!";
                if ($scope.bet.tie > 0){
                    if ($scope.card.value == 14){
                        $scope.message += " You've won " + ($scope.bet.tie * $scope.ties[$scope.correct].acePay) + " ether!";
                    } else {
                        $scope.message += " You've won " + ($scope.bet.tie * $scope.ties[$scope.correct].twoKPay) + " ether!";
                    }
                } else {
                    $scope.message += " You didn't place a Tie Bet, better luck next time!"
                }
            } else if ($scope.card.value > $scope.prevCard.value && !high){
                $scope.gameOver = true;
                $scope.message += " but it was Higher!"
            } else if ($scope.card.value < $scope.prevCard.value && high){
                $scope.gameOver = true;
                $scope.message += " but it was Lower!"
            } else {
                $scope.message += " and you were Correct!";
                $scope.correct++;
                if ($scope.correct == 3){
                    $scope.message += " Congratulations, you've made it to Level 2! You are guaranteed your money now! You also get a chance to switch your card!";
                    $scope.phase = "Play or Switch"
                } else if ($scope.correct == 6){
                    $scope.message += " YOU'VE JUST WON THE GAME! Your payout is " + Math.round($scope.wins[2].val * $scope.bet.wager * 100)/100 + " ether!";
                    $scope.gameOver = true;
                }
            }

            if ($scope.gameOver && $scope.correct >=3 && $scope.correct < 6){
                $scope.message += " Hey! At least you won your bet of " + $scope.bet.wager +" ether back!"
            }
        }

        function dealCard() {
            var card = $scope.deck[0];
            $scope.deck.shift();
            return card;
        }

        $scope.buildDeck = function(){
            $scope.deck = [];
            var index = 0;
            while (index < $scope.deckSize) {
                var config = $scope.cardConfiguration;
                config.suits.each(function(suit){
                    config.values.each(function(value){
                        $scope.deck.push({
                            name: value.name + " of " + suit.name,
                            symbol: value.symbol + suit.symbol,
                            color:suit.color,
                            suit: suit.name,
                            face: value.name,
                            value: value.value,
                            selected: false
                        });
                    })
                })
                ++index;
            }
            $scope.deck = shuffle(shuffle(shuffle(shuffle($scope.deck))));
        };

        $scope.setDeckSize = function (size){
            $scope.deckSize = size;
        };

        function shuffle(array) {
            var currentIndex = array.length, temporaryValue, randomIndex;

            // While there remain elements to shuffle...
            while (0 !== currentIndex) {

                // Pick a remaining element...
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex -= 1;

                // And swap it with the current element.
                temporaryValue = array[currentIndex];
                array[currentIndex] = array[randomIndex];
                array[randomIndex] = temporaryValue;
            }

            return array;
        }

        init();
    })
    .controller('cribbageCtrl',function($scope, $modal, $http, $log){
        var data = $scope.data = {};

        function init(){
            $scope.cardConfiguration = {
                "suits":[
                    {
                        "name":"Hearts",
                        "symbol":" &hearts;",
                        "color":"red"
                    },
                    {
                        "name":"Diamonds",
                        "symbol":" &diams;",
                        "color":"red"
                    },
                    {
                        "name":"Spades",
                        "symbol":" &spades;",
                        "color":"black"
                    },
                    {
                        "name":"Clubs",
                        "symbol":" &clubs;",
                        "color":"black"
                    }
                ],
                "values":[
                    {
                        "name": "Two",
                        "symbol":"2",
                        "value": 2
                    },
                    {
                        "name": "Three",
                        "symbol":"3",
                        "value": 3
                    },
                    {
                        "name": "Four",
                        "symbol":"4",
                        "value": 4
                    },
                    {
                        "name": "Five",
                        "symbol":"5",
                        "value": 5
                    },
                    {
                        "name": "Six",
                        "symbol":"6",
                        "value": 6
                    },
                    {
                        "name": "Seven",
                        "symbol":"7",
                        "value": 7
                    },
                    {
                        "name": "Eight",
                        "symbol":"8",
                        "value": 8
                    },
                    {
                        "name": "Nine",
                        "symbol":"9",
                        "value": 9
                    },
                    {
                        "name": "Ten",
                        "symbol":"10",
                        "value": 10
                    },
                    {
                        "name": "Jack",
                        "symbol":"J",
                        "value": 10
                    },
                    {
                        "name": "Queen",
                        "symbol":"Q",
                        "value": 10
                    },
                    {
                        "name": "King",
                        "symbol":"K",
                        "value": 10
                    },
                    {
                        "name": "Ace",
                        "symbol":"A",
                        "value": 1
                    }
                ]
            };

            $scope.newGame();

             /* Phases of the Game:
              * Deal Hands
              * Add To Crib
              * Flip Starter Card
              * Non-Dealer plays First
              * Alternate Plays
              *
              * */

            $scope.phase = "start";
        }

        $scope.newGame = function(){
            $scope.players = 2;
            data.players = [];
            $scope.dealer = 0;
            var index = 0;
            while (index < $scope.players){
                data.players.push({
                    index : index,
                    hand : [],
                    score : 0,
                    dealer: index==0
                })
                ++index;
            }

            $scope.buildDeck();
        }

        $scope.buildDeck = function(){
            $scope.deck = [];
            var config = $scope.cardConfiguration;
            config.suits.each(function(suit){
                config.values.each(function(value){
                    $scope.deck.push({
                        name: value.name + " of " + suit.name,
                        symbol: value.symbol + suit.symbol,
                        color:suit.color,
                        suit: suit.name,
                        face: value.name,
                        value: value.value,
                        selected: false
                    });
                })
            })
            $scope.deck = shuffle($scope.deck);
        };

        $scope.dealHands = function(){
            data.players.each(function(player){
                var cards = 0;
                player.hand = [];
                player.copy = [];
                while (cards < 6){
                    player.hand.push($scope.deck[0]);
                    player.copy.push($scope.deck[0]);
                    $scope.deck.shift();
                    ++cards;
                }
            });
            $scope.phase = 'add to crib';
            data.starter = null;
            data.total = 0;
            data.play = [];
            data.crib = [];
        };

        $scope.updateCards = function(card){
            if ($scope.phase == 'add to crib'){
                card.selected = !card.selected;
                if (card.selected){
                    data.crib.push(card);
                } else {
                    data.crib.remove(function(el) { return el.name === card.name; });

                }
            } else if ($scope.phase == 'play'){
                var index = $scope.playerTurn%2;
                data.play.push(card);
                data.total += card.value;
                scoreCards(data.play, index);
                data.players[index].hand.remove(function(el) { return el.name === card.name; });
                $scope.playerTurn++;
            }
        };

        function scoreCards(cards, index) {
            if ($scope.phase == 'play'){
                scorePegging(index);
            } else {
                console.log(scoreFifteens(cards));
                console.log(scorePairs(cards));
            }

        }

        function scorePegging(index){
            if (data.total == 15){
                data.players[index].score += 2;
            } else if (data.total == 31){
                data.players[index].score += 2;
            }
        }

        function scoreFifteens(cards){
            var hand = cards.push(data.starter);
            var score = 0;

            var i = 0;
            var j = 1;
            var total = 0;

            for (i=0; i < hand.length()-1; i++){
                total = hand[i].value;
                for (j = i + 1; j < hand.length; j++) {
                    total += hand[j];
                    if (total == 15) {
                        score += 2;
                    }

                    if (total > 14) {
                        total = hand[i];
                    }
                }
            }
            
            return score;
        }

        function scorePairs(cards){
            var hand = cards.push(data.starter);
            var score = 0;

            var i = 0;
            var j = 1;

            for (i=0; i < hand.length()-1; i++){
                for (j = i + 1; j < hand.length; j++) {
                    if (hand[i].symbol === hand[j].symbol){
                        score += 2;
                    }
                }
            }

            return score;
        }

        $scope.finalizeCrib = function(){
            $scope.phase = 'play';
            data.starter = $scope.deck[0];
            $scope.deck.shift();

            data.players.each(function(player){
                var index = 0, removed = 0;
                while (removed < 2){
                    var card = player.hand[index];
                    if (card.selected){
                        player.hand.remove(function(el) { return el.name === card.name; });
                        player.copy.remove(function(el) { return el.name === card.name; });
                        ++removed;
                    } else index++;
                }
            });

            $scope.playerTurn = $scope.dealer==0?1:0;
            if (data.starter.face == "Jack"){
                data.players[$scope.dealer].score += 2;
            }
        };

        function shuffle(array) {
            var currentIndex = array.length, temporaryValue, randomIndex;

            // While there remain elements to shuffle...
            while (0 !== currentIndex) {

                // Pick a remaining element...
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex -= 1;

                // And swap it with the current element.
                temporaryValue = array[currentIndex];
                array[currentIndex] = array[randomIndex];
                array[randomIndex] = temporaryValue;
            }

            return array;
        }

        init();

    })
    .controller('postsHomeCtrl',[
        '$scope',
        'posts',
        'auth',
        function($scope, posts, auth){
            $scope.posts = posts.posts;
            $scope.isLoggedIn = auth.isLoggedIn;

            $scope.addPost = function(){
                if(!$scope.title || $scope.title === '') { return; }
                posts.create({
                    title: $scope.title,
                    link: $scope.link
                });
                $scope.title = '';
                $scope.link = '';
            };

            $scope.incrementUpvotes = function(post) {
                posts.upvote(post);
            };
        }
    ])
    .controller('postsCtrl', [
        '$scope',
        'post',
        'posts',
        'auth',
        function($scope, post, posts, auth){
            $scope.post = post;
            $scope.isLoggedIn = auth.isLoggedIn;

            $scope.addComment = function(){
                if($scope.body === '') { return; }
                posts.addComment(post._id, {
                    body: $scope.body
                }).success(function(comment) {
                    $scope.post.comments.push(comment);
                });
                $scope.body = '';
            };

            $scope.incrementUpvotes = function(comment){
                posts.upvoteComment(post, comment);
            };
        }])
    .filter('unsafe', function($sce) {
        return function(val) {
            return $sce.trustAsHtml(val);
        };
    })
    .factory('LoadPlayersService', function($q,$timeout,$http) {
        var players = {
            fetch: function(callback) {
                var deferred = $q.defer();
                $timeout(function() {
                    $http.get("data/data.json").success(function(data) {
                        deferred.resolve(data);
                    });
                }, 30);

                return deferred.promise;
            }
        };

        return players;
    });