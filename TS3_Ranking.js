registerPlugin({
  name: 'TS3 Ranking',
  version: '2.0',
  description: 'Clients are added to server groups after reaching required time.',
  author: 'R3flex <r3flexmlg@gmail.com>',
  engine: ">= 1.0.0",
  // ENABLEWEB: true,
  // REQUIREDMODULES: ['ws'],
  vars: {
  afirstGroup: {
    title: 'Specify the server group ID of the first level.',
    type: 'number'
  },
  Levels: {
    title: 'Level',
    type: 'array',
    vars: [
      {
        name: 'time',
        indent: 1,
        title: 'Time to gain this level. (hours)',
        type: 'number',
        placeholder: '5'
      },
      {
        name: 'sgid',
        indent: 1,
        title: 'Servergroup ID.',
        type: 'number',
        placeholder: '32'
      },
      {
        name: 'msg_type',
        indent: 1,
        title: 'Message Type.',
        type: 'select',
        options: ['None', 'Poke', 'Chat']
      },
      {
        name: 'msg',
        indent: 1,
        title: 'Message.',
        type: 'string',
        placeholder: 'You advanced to 10 level!'
      }
      ]
  },
  ignoredGroups: {
    title: 'Ignored Group.',
    type: 'array',
    vars: [
      {
        name: 'ignoredGroup',
        indent: 1,
        title: 'Servergroup ID.',
        type: 'string',
        placeholder: '8'
      }
    ]
  },
  ignored_uids: {
    title: 'Ignored UIDs.',
    type: 'array',
    vars: [
      {
        name: 'uid',
        indent: 1,
        title: 'UID:',
        type: 'string',
        placeholder: 'K9FOHtY/nMjzfZaSFjAnZA4'
      }
    ]
  },
  AFKthreshold: {
    title: 'Specify the anty afk threshold in minutes (After this amount of minutes, the script will stop adding the time.)',
    type: 'number'
  },
  drankingChannel: {
    title: 'TOP 10 ranking channel.',
    type: 'channel'
  },
  etopChannelRecords: {
    title: 'How many records to display.',
    type: 'number',
    placeholder: '10'
  },
  recordaNameColor: {
    title: 'Nicks Color',
    type: 'string',
    placeholder: '#FFF'
  },
  recordbTimeColor: {
    title: 'Time Color',
    type: 'string',
    placeholder: '#FFF'
  },
  recordcFormatColor: {
    title: 'Format Color',
    type: 'string',
    placeholder: '#FFF'
  }
}
}, function main(sinusbot, config) {

var event = require('event');
var store = require('store');
var engine = require('engine');
var backend = require('backend');
var helpers = require('helpers');

var delayTime = 3;

// Sanitize variables
const levels = config.Levels;
const levels_sorted = levels.sort((alpha, beta) => new Number(beta.time) - new Number(alpha.time));
const ignored_groups = config.ignoredGroups;
const ignored_UIDs = config.ignored_uids;
const afk_time = config.AFKthreshold || 20;
var channel = backend.getChannelByID(config.drankingChannel);
var limit = config.etopChannelRecords || 0;
const list_nick_color = config.recordaNameColor || '#33BB00'; 
const list_time_color = config.recordbTimeColor || '#EEEE00';
const list_format_color = config.recordcFormatColor || '#BAE9FF';

// Startup DB
if (!store.get('client_db')) store.set('client_db', {});
var client_db = store.get('client_db');

// Log erros
if (!channel) engine.log("Channel ID isn't defined!");
 
// On client join, add/remove levels.
event.on('clientMove', function(ev) {
  var channel = ev.fromChannel;
  if (channel) return;
  var client = ev.client;
  if (!is_client_ignored(client)) {
    if (!client_db[client.uid()]) register_client(client);
  }
  guard_rank(client);
})

event.on('chat', function(ev) {
  if (ev.mode != 1) return;
  var text = ev.text;
  if (text != "!export_db") return;
  let db = store.get('client_db');
  ev.client.chat(JSON.stringify(db));
})

function add_time() {
  // Get all online clients.
  var clients = backend.getClients();
  // Filter out afk clients.
  clients = clients.filter(not_afk);
  // Filter ignored clients by sgid.
  clients = clients.filter(not_ignored_by_sgid);
  // Filter ignored clients by UID.
  clients = clients.filter(not_ignored_by_uid);
  // Filter duplicates.
  clients = clients.filter(remove_duplicate);
  // Update time for all users.
  clients.forEach(update_time);
}

function channel_display_ranking() {
  if (!channel) channel = backend.getChannelByID(config.drankingChannel);
  if (!channel) return engine.log("Ranking channel isn't defined!");
  var db = client_db;

  var keys = Object.keys(db);
  keys.forEach(function(uid) {
    var client = backend.getClientByUID(uid);
    if (!client) return;
    // Filter db array with ignored UID's
    if (!not_ignored_by_uid(client)) delete db[uid];
    // Filter db array with ignored SGID's
    if (!not_ignored_by_sgid(client)) delete db[uid];
  });

  // Convert object to array, so sort function will work.
  let entries = Object.values(db);
  var db_sorted = entries.sort((a, b) => new Number(b.time) - new Number(a.time));
  // If setting is higher than actual list.
  if (db_sorted.length < limit) limit = db_sorted.length;

  var list = "";
  db_sorted.forEach(function(row) {
    var row_formatted = '[*]' + '[SIZE=16][COLOR=' + list_nick_color + '][B]' + row.nick + '[/B][/COLOR][/SIZE]' + '[SIZE=14][B][COLOR='+list_time_color+'] ' + Math.floor(new Number(row.time)/3600/24) + ' [/COLOR][COLOR='+list_format_color+']Days[/COLOR][COLOR='+list_time_color+'] ' + Math.floor((new Number(row.time)%86400)/3600) + ' [/COLOR][COLOR='+list_format_color+']Hours[/COLOR][COLOR='+list_time_color+'] ' + Math.floor((new Number(row.time)%3600)/60) + ' [/COLOR][COLOR='+list_format_color+']Minutes[/COLOR][/B][/SIZE]'; 
    list += row_formatted;
  })
  list = '[list=1]' + list + '[/list]';
  channel.update({description : list});
}

function save_db() {
  store.set("client_db", client_db);
}

function guard_rank(client) {
  var ignored = is_client_ignored(client);
  if (!levels_sorted) return engine.log("Levels are not defined!");
  //var db = store.get("client_db");
  if (client_db[client.uid()]) {
    client.db_time = new Number(client_db[client.uid()].time);
  } else {
    client.db_time = 0;
  };

  if (!ignored) {
  // Find allowed SG.
  var lvl_add = levels_sorted.find(function(level) {
    return new Number(client.db_time) >= new Number(level.time*3600);
  });
  // Add SG.
  // If client has minimum time to get level
  if (lvl_add) {
    if (!has_server_group(client.getServerGroups(), lvl_add.sgid)) {
      client.addToServerGroup(lvl_add.sgid);
      if (lvl_add.msg_type == 1) {
        client.poke(lvl_add.msg);
      } else if (lvl_add.msg_type == 2) {
        client.chat(lvl_add.msg);
      }
    }
    // Find disallowed SG's.
    var lvls_disallowed = levels_sorted.filter(function(level) {
      return lvl_add.sgid != level.sgid;
    });
  // If client has time below lvl-1, mark all levels as disallowed.
  } else {
    lvls_disallowed = levels_sorted;
  }
  // Remove SG's.
  lvls_disallowed.forEach(function(level) {
    if (has_server_group(client.getServerGroups(), level.sgid)) {
      client.removeFromServerGroup(level.sgid);
    }
  });
} else {
  levels_sorted.forEach(function(level) {
    if (has_server_group(client.getServerGroups(), level.sgid)) {
      client.removeFromServerGroup(level.sgid);
    }
  });
}
}

function unset_all() {
  store.unset("client_db");
  store.unset("client_db");
  // for (let i = 0; i < 10; i++) {
  //   store.unset(i);
  // }
}

function rank_guardian_loop() {
  var clients = backend.getClients();
  clients.forEach(function(client) {
    guard_rank(client);
  });
  setTimeout(rank_guardian_loop, delayTime*1000);
}

function channel_loop() {
  channel_display_ranking();
  setTimeout(channel_loop, delayTime*1000);
}

function add_time_loop() {
  add_time();
  setTimeout(add_time_loop, delayTime*1000);
}

function save_db_loop() {
  save_db();
  setTimeout(save_db, 30*1000);
}

add_time_loop();
channel_loop();
rank_guardian_loop();
save_db_loop();

function DB_Client(nick, time) {
  this.nick = nick;
  this.time = time;
}

function not_afk(client) {
  return (client.getIdleTime()/1000) < (afk_time*60);
}

function not_ignored_by_sgid(client) {
  var client_sg_list = client.getServerGroups();
  return ignored_groups.every(function(ig_sg) {
    return !has_server_group(client_sg_list, ig_sg.ignoredGroup);
  });
}

function has_server_group(sg_list, sg_id) {
  return sg_list.some(function(sg) {
    return sg.id() == sg_id;
  });
}

function not_ignored_by_uid(client) {
  var uid = client.uid();
  return ignored_UIDs.every(function(ig) {
    return ig.uid != uid;
  });
}

function remove_duplicate(client_target, pos, clients_array) {
  // Transforms original array from [{obj}, {obj}] to [uid, uid]
  return clients_array.map(function(client) { 
    return client.uid();
  }).indexOf(client_target.uid()) == pos;
}

function update_time(client) {
  var uid = client.uid();
  if (client_db[uid]) {
    client_db[uid].time += delayTime;
  } else {
    register_client(client);
  }
}

function register_client(client) {
  client_db[client.uid()] = new DB_Client(client.nick(), 30);
}

function is_client_ignored(client) {
  var sg_ignored = !not_ignored_by_sgid(client);
  var uid_ignored = !not_ignored_by_uid(client);
  return sg_ignored || uid_ignored;
}

});