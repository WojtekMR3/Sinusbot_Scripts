registerPlugin({
  name: 'TS3 Ranking',
  version: '2.0',
  description: 'Clients are added to server groups after reaching required time.',
  author: 'R3flex <r3flexmlg@gmail.com>',
  engine: ">= 1.0.0",
  //enableweb: true,
  vars: {
  enable_migration: {
    title: 'Enable migrations',
    type: 'checkbox'
  },
  enable_join_chat_dbinfo: {
    title: 'Enable welcome info.',
    type: 'checkbox'
  },
  migration_export_amount: {
    title: 'Entries amount to export.',
    type: 'number',
    conditions: [{
        field: 'enable_migration',
        value: 1,
    }]
  },
  migration_sgid: {
    title: 'SGID needed to execute migration commands.',
    type: 'number',
    conditions: [{
        field: 'enable_migration',
        value: 1,
    }]
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
        title: 'Message.',
        type: 'string',
        indent: 1,
        placeholder: 'You advanced to 10 level!',
        conditions: [{
            field: 'msg_type',
            value: 1
        }]
      },
      {
        name: 'msg',
        title: 'Message.',
        type: 'string',
        indent: 1,
        placeholder: 'You advanced to 10 level!',
        conditions: [{
            field: 'msg_type',
            value: 2
        }]
      }
      ]
  },
  ignored_groups: {
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
  AFK_threshold: {
    title: 'Max AFK time (Minutes).',
    type: 'number'
  },
  ranking_channel: {
    title: 'TOP 10 ranking channel.',
    type: 'channel'
  },
  top_channel_records: {
    title: 'How many records to display.',
    type: 'number',
    placeholder: '10'
  },
  enable_ch_nick_hyperlink: {
    title: 'Enable nick hyperlink.',
    type: 'checkbox'
  },
  record_name_color: {
    title: 'Nicks Color',
    type: 'string',
    placeholder: '#FFF'
  },
  record_time_color: {
    title: 'Time Color',
    type: 'string',
    placeholder: '#FFF'
  },
  record_format_color: {
    title: 'Format Color',
    type: 'string',
    placeholder: '#FFF'
  }
}
}, (sinusbot, config) => {

var event = require('event');
var store = require('store');
var engine = require('engine');
var backend = require('backend');
var format = require('format');

var delayTime = 60;

// Sanitize variables
var levels = config.Levels;
var levels_sorted = levels.sort((a, b) => new Number(a.time - b.time));
levels_sorted = levels_sorted.map((level, index) => {
  level.lvl = index+1;
  return level;
});
levels_sorted = levels.sort((a, b) => new Number(b.time - a.time));

const ignored_groups = config.ignored_groups || [{ignoredGroup: -65536}];
const ignored_UIDs = config.ignored_uids || [{uid: -65536}];
const afk_time = config.AFK_threshold || 20;
var channel = backend.getChannelByID(config.ranking_channel);
var limit = config.top_channel_records || 0;
const enable_join_chat_dbinfo = config.enable_join_chat_dbinfo || 0;
const enable_ch_nick_hyperlink = config.enable_ch_nick_hyperlink || 0;
const list_nick_color = config.record_name_color || '#33BB00';
const list_time_color = config.record_time_color || '#EEEE00';
const list_format_color = config.record_format_color || '#BAE9FF';
// Migration
const migration_enabled = config.enable_migration;
const migration_export_amount = config.migration_export_amount || 50;
const migration_sgid = config.migration_sgid || -100;

// Startup DB
if (!store.get('client_db')) store.set('client_db', {});
var client_db = store.get('client_db');

// Log erros
if (!channel) engine.log("Channel ID isn't defined!");

// On client join, add/remove levels.
event.on('clientMove', (ev) => {
  var channel = ev.fromChannel;
  if (channel) return;
  var client = ev.client;
  if (!is_client_ignored(client)) {
    if (!client_db[client.uid()]) register_client(client);
  }
  guard_rank(client);
  if (enable_join_chat_dbinfo) chat_client_db_info(client);
})

engine.log(`Instance ID: ${engine.getInstanceID()}`);
engine.log(`Bot ID: ${engine.getBotID()}`);

// API
event.on('public:foobar', function(ev) {
  let data = ev.data();
  let incoming_ip = data.ip;
  let clients = backend.getClients();
  let client = clients.find(client => client.getIPAddress() == incoming_ip)
  let uid = client.uid();
  return get_client_db_info(uid);
});

event.on('chat', message_handler);

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
  if (!channel) channel = backend.getChannelByID(config.ranking_channel);
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

  // Convert from uid = {nick, time} to {nick, time, uid}
  db = Object.entries(client_db);
  db = db.map((row) => {
    row[1].uid = row[0];
    return row[1];
  });
  var db_sorted = db.sort((a, b) => new Number(b.time - a.time));
  // If setting is higher than actual list.
  if (db_sorted.length > limit) db_sorted.length = limit;

  var list = "";
  db_sorted.forEach(function(row) {
    let uid = row.uid;
    let nc = list_nick_color;
    let tc = list_time_color;
    let fc = list_format_color;
    let days = Math.floor(new Number(row.time)/3600/24);
    let hours = Math.floor((new Number(row.time)%(3600*24))/3600);
    let minutes = Math.floor((new Number(row.time)%3600)/60);
    if (enable_ch_nick_hyperlink) {
      var nick_block = `[URL=client://${uid}]${format.bold(row.nick)} [/URL]`;
    } else {
      var nick_block = `${format.bold(row.nick)} `;
    }
    let row_formatted = `[*][SIZE=16][COLOR=${nc}]${nick_block}[/COLOR][/SIZE][SIZE=14]${format.bold(`${format.color(days, tc)} ${format.color("Days", fc)} ${format.color(hours, tc)} ${format.color("Hours", fc)} ${format.color(minutes, tc)} ${format.color("Minutes", fc)}`)}[/SIZE]`;
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
  if (client_db[client.uid()]) {
    client.db_time = new Number(client_db[client.uid()].time);
  } else {
    client.db_time = 0;
  };

  if (!ignored) {
  // Find allowed SG.
  var lvl_add = levels_sorted.find(level => new Number(client.db_time) >= new Number(level.time*3600));
  // Add SG.
  // If client has minimum time to get level
  if (lvl_add) {
    if (!has_server_group(client.getServerGroups(), lvl_add.sgid)) {
      client.addToServerGroup(lvl_add.sgid);
      if (!backend.getServerGroupByID(lvl_add.sgid)) return engine.log(`Server group doesn't exist! SGID: ${lvl_add.sgid}`);
      if (lvl_add.msg_type == 1) {
        client.poke(lvl_add.msg);
      } else if (lvl_add.msg_type == 2) {
        client.chat(lvl_add.msg);
      }
    }
    // Find disallowed SG's.
    var lvls_disallowed = levels_sorted.filter(level => lvl_add.sgid != level.sgid);
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
  setTimeout(save_db_loop, delayTime*1000);
}

// Start adding time 60s after saving changes.
setTimeout(add_time_loop, delayTime*1000);
setTimeout(save_db_loop, delayTime*1000);
// Run these functions instantly on start / saving changes.
channel_loop();
rank_guardian_loop();

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
  client_db[client.uid()] = new DB_Client(client.nick(), delayTime);
}

function is_client_ignored(client) {
  var sg_ignored = !not_ignored_by_sgid(client);
  var uid_ignored = !not_ignored_by_uid(client);
  return sg_ignored || uid_ignored;
}

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function message_handler(ev) {
  if (ev.mode != 1) return;
  let client = ev.client;
  var text = ev.text;
  text = text.toLowerCase();
  if (text == "!export_db") {
    // Check if migration is enabled and client has permissions.
    if (!migration_enabled) return client.chat(format.color(format.bold("Migrations are not enabled!"), "#d2b72f"));
    if (!has_server_group(client.getServerGroups(), migration_sgid)) return client.chat(format.color(format.bold("You dont have permissions to use migration!"), "#d2b72f"));
    // Get client_db.
    let db = store.get('client_db');
    // Create entries from object.
    let entries = Object.entries(db);
    // Sort entries
    let entries_sorted = entries.sort((a, b) => new Number(b[1].time) - new Number(a[1].time));
    // Apply export amount limit.
    if (entries_sorted.length > migration_export_amount) entries_sorted.length = migration_export_amount;
    if (entries_sorted.length == 0) return client.chat(format.bold(`${format.color("Exporting failed!", "#ff3e3e")} Database is empty!`));
    let export_db = {};
    entries_sorted.forEach(function(entry) {
      let uid = entry[0];
      let nick = entry[1].nick;
      let time = entry[1].time;
      export_db[uid] = new DB_Client(nick, time);
    });
    let len = "!import_db ".length + JSON.stringify(export_db).length;
    if (len > 8192) return client.chat(format.bold(`${format.color("Error DB is too large!","#ff3e3e")} Try lowering export limit.`));
    client.chat(format.bold(`${format.color("Exporting succesful!", "#00bf00")} Exported ${entries_sorted.length} sets`));
    client.chat(`${format.bold("!import_db")} ${JSON.stringify(export_db)}`);
  }

  if (text.includes("!import_db")) {
    // Check if migration is enabled and client has permissions.
    if (!migration_enabled) return client.chat(format.color(format.bold("Migrations are not enabled!"), "#d2b72f"));
    if (!has_server_group(client.getServerGroups(), migration_sgid)) return client.chat(format.color(format.bold("You dont have permissions to use migration!"), "#d2b72f"));
    text = text.replace("!import_db", "").trim();
    // Check if text is JSON valid.
    if (!IsJsonString(text)) return client.chat(format.color(format.bold("Error JSON is not valid!"), "#ff3e3e"));
    let import_object = JSON.parse(text);
    let values = Object.values(import_object);
    let keys = Object.keys(import_object);
    // Map values of Client_DB object.
    let true_values = values.map(function(obj) {
      if (obj.hasOwnProperty('time') && obj.hasOwnProperty('nick')) {
        return true;
      } else {
        return false;
      }
    });
    let pos = true_values.findIndex(value => value == false);
    var false_value = keys[pos];
    // If each object has properties @int "time", @string "nick".
    if (false_value) return client.chat(`${format.color(format.bold("Invalid format!"), "#ff3e3e")}  Missing property '${format.color(format.bold("time"), "#009fff")}' or '${format.color(format.bold("nick"), "#009fff")}' at ${format.bold(`position: ${pos}`)} ${format.italic(false_value)}`);
    let import_bools = keys.map(function(uid) {
      // If Client_DB entry already exists.
      if (client_db[uid]) {
        let time = client_db[uid].time;
        // If entry property "time" is higher than imported one - Skip.
        if (time >= import_object[uid].time) {
         client.chat(format.bold(`${format.color("Skipped: ", '#FFA200')} ${import_object[uid].nick}`));
         return false;
        } else { // Import time.
         client_db[uid].time += new Number(import_object[uid].time);
         return true;
        }
      } else { // Import entry.
        client_db[uid] = new DB_Client(import_object[uid].nick, new Number(import_object[uid].time));
        return true;
      }
    });
    // Succed, Skip log.
    let succeded_count = import_bools.filter(x => x == true).length;
    let skipped_count = import_bools.length - succeded_count;
    client.chat(`${format.color(format.bold(`Succeded: ${succeded_count}`), '#00bf00')} ${format.color(format.bold(`Skipped: ${skipped_count}`), '#FFA200')}`);
  }

  if (text.includes("!rank")) {
    chat_client_db_info(client);
  }
}

function get_db_rank(uid) {
  if (!client_db[uid]) return "Client not found!";
  let db = Object.entries(client_db);
  db = db.map((row) => {
    row[1].uid = row[0];
    return row[1];
  });
  db = db.sort((a, b) => new Number(b.time) - new Number(a.time));
  let rank = db.findIndex(row => row.uid == uid) + 1;
  let max = db.length;
  return {
    rank: rank,
    max: max
  }
}

// returns {current lvl, next lvl, time to next lvl, rank, time spent in seconds etc. just api}
function get_client_db_info(uid) {
  if (!client_db[uid]) return {error: `UID: ${uid} wasn't found in database!`};
  let time = client_db[uid].time;
  let lvl = levels_sorted.find(level => new Number(time) >= new Number(level.time*3600));
  if (lvl == null) {
    var lvl_numeric = 0;
  } else {
    var lvl_numeric = lvl.lvl;
  }
  // Make copy of original level's clients_array.
  let reverse_lvls = levels_sorted.slice().reverse();
  let next_lvl = reverse_lvls.find(level => new Number(time) < new Number(level.time*3600));
  if (next_lvl == null) {
    var next_lvl_numeric = null;
    var remaining_time = null;
  } else {
    var next_lvl_numeric = next_lvl.lvl;
    var to_next_level = (next_lvl.time*3600) - time;
    var remaining_time = Math.round(to_next_level/3600 * 10) / 10;
  }
  let rank_info = get_db_rank(uid);
  return {
    lvl: lvl_numeric,
    next_lvl: next_lvl_numeric,
    to_next_lvl: remaining_time,
    time: time,
    rank: rank_info.rank,
    max_rank: rank_info.max
  };
}

function chat_client_db_info(client) {
  let uid = client.uid();
  let info = get_client_db_info(uid);
  if (info.error) return client.chat(format.color(format.bold(info.error), "#ff3e3e"));
  let hours = (info.time/3600).toFixed(1);
  client.chat(`Total time: ${format.bold(`${hours} hours`)}`);
  client.chat(`${format.color(format.bold("Rank"), "#FBD500")}: ${format.bold(`${info.rank}/${info.max_rank}`)}`);
  // If level is max or there is only single lvl.
  if (info.next_lvl == null) {
    client.chat(`Level: ${format.bold(info.lvl)}`);
  } else {
    client.chat(`${format.color(format.bold("Level"), "#FBD500")}: ${format.bold(info.lvl)}, ${format.color(format.bold(info.to_next_lvl), "#5193ee")} hours to level ${format.bold(info.next_lvl)}`);
  }
}

});