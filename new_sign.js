const $ = new Env('新版领京豆');

const notify = $.isNode() ? require('./sendNotify') : '';
const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
let cookiesArr = [], cookie = '', message;
let h = {
  'Cookie': cookie,
  'Host': 'api.m.jd.com',
  'Accept': '*/*',
  'Connection': 'keep-alive',
  'User-Agent': $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0"),
  'Accept-Language': 'zh-Hans-CN;q=1,en-CN;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Content-Type': "application/x-www-form-urlencoded"
}

if ($.isNode()) {
  Object.keys(jdCookieNode).forEach((item) => {
    cookiesArr.push(jdCookieNode[item])
  })
  if (process.env.JD_DEBUG && process.env.JD_DEBUG === 'false') console.log = () => {
  };
} else {
  cookiesArr = [$.getdata('CookieJD'), $.getdata('CookieJD2'), ...$.toObj($.getdata('CookiesJD') || "[]").map(item => item.cookie)].filter(item => !!item);
}
const JD_API_HOST = 'https://api.m.jd.com/';

!(async () => {
  if (!cookiesArr[0]) {
    $.msg($.name, '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/bean/signIndex.action', {"open-url": "https://bean.m.jd.com/bean/signIndex.action"});
    return;
  }
  for (let i = 0; i < cookiesArr.length; i++) {
    if (cookiesArr[i]) {
      cookie = cookiesArr[i]
      h['Cookie'] = cookie
      $.UserName = decodeURIComponent(cookie.match(/pt_pin=(.+?);/) && cookie.match(/pt_pin=(.+?);/)[1])
      $.index = i + 1;
      $.isLogin = true;
      $.nickName = '';
      message = '';
      await TotalBean();
      $.log(`\n******开始【京东账号${$.index}】${$.nickName || $.UserName}*********\n`);
      if (!$.isLogin) {
        $.msg($.name, `【提示】cookie已失效`, `京东账号${$.index} ${$.nickName || $.UserName}\n请重新登录获取\nhttps://bean.m.jd.com/bean/signIndex.action`, {"open-url": "https://bean.m.jd.com/bean/signIndex.action"});
        if ($.isNode()) {
          await notify.sendNotify(`${$.name}cookie已失效 - ${$.UserName}`, `京东账号${$.index} ${$.UserName}\n请重新登录获取cookie`);
        }
        continue
      }
      await jdBeanHome();
    }
  }
})()
  .catch((e) => {
    $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
  })
  .finally(() => {
    $.done();
  })

async function jdBeanHome() {
  $.score = 0
  await getHomeInfo()
  for (let i = 0; i < 20 && !$.flag; ++i) {
    await getTaskList()
  }
  await getHomeInfo(!!1)
  await showMsg();
}

function showMsg() {
  return new Promise(resolve => {
    message += `\n本次运行获得${$.score}成长值`
    $.msg($.name, '', `【京东账号${$.index}】${$.nickName}\n${message}`);
    resolve()
  })
}

function getHomeInfo(info=false) {
  return new Promise(async resolve => {
    let body = {"rnVersion": "4.7", "rnClient": "2", "source": "AppHome"}
    let config = await taskUrl('findBeanScene', body)
    post(config).then(data => {
      if(data.data && data.data.curScene) {
        const {growth, level, sceneLevelConfig} = (data.data.curScene)
        $.log(`当前等级：${level}，成长值：${growth}，升级还需：${sceneLevelConfig.growthEnd - growth}`)
        if(level===0) $.flag = true
        else $.flag = false
        if(info) message += `当前等级：${level}，成长值：${growth}，升级还需：${sceneLevelConfig.growthEnd - growth}`
      }
    }).finally(() => resolve())
  })
}
process.on('unhandledRejection', (reason, p) => {
});
function getTaskList() {
  return new Promise(resolve => {
    post(taskPostUrl('beanTaskList', {}, "body=%7B%7D&uuid=8888888&client=apple&clientVersion=9.4.1&st=1614061568059&sign=53f8f8692792fa2d972db0416a4d7ffd&sv=111"))
      .then(async data => {
        $.flag = true
        if (data.code === '0') {
          for (let task of data.data.taskInfos) {
            if (task.times < task.maxTimes) {
              $.flag = false
              $.log(`${task.taskName}，任务完成进度：${task.process}`)
              if (task.taskType === 9 || task.taskType === 8) {
                await doTask(task.subTaskVOS[0].taskToken, 1)
                $.log(`等待5秒完成任务`)
                await $.wait(5 * 1000)
              }
              await doTask(task.subTaskVOS[0].taskToken, 0)
              await $.wait(500)
            }
          }
        }
      }).finally(() => resolve())
  })
}

function doTask(taskToken, actionType = 0) {
  return new Promise(async resolve => {
    const body = {"actionType": actionType, "taskToken": taskToken};
    let config = await taskUrl('beanDoTask', body)
    post(config).then(data => {
        if (data.code === '0' && data.data && data.data.bizCode === '0') {
          if (actionType === 1) {
            $.log(`任务上报成功`)
          } else {
            $.score += parseInt(data.data.score)
            $.log(`任务完成成功，获得成长值${data.data.score}，任务完成进度:${data.data.times}/${data.data.maxTimes}`)
          }
        } else {
          $.log(data.errorMessage)
        }
      }
    ).finally(() => resolve())
  })
}


function getSign(function_id, body) {
  return new Promise(resolve => {
    body = `functionId=${function_id}&body=${escape(JSON.stringify(body))}&uuid=8888888&client=apple&clientVersion=9.4.1`
    post({
      url: 'http://42.193.148.210:5005/getSignFromJni',
      body: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).then(data => resolve(`https://api.m.jd.com/client.action?functionId=${function_id}&uuid=8888888&client=apple&clientVersion=9.4.1&${data}`)).finally(() => resolve())
  })
}

function post(config) {
  return new Promise((resolve,reject) => {
    $.post(config, (err, resp, data) => {
      try {
        if (err) {
          $.log(`${$.toStr(err)}`)
          $.log(`${$.name} API请求失败，请检查网路重试`)
          reject("网络错误")
        } else {
          if ($.safeGet(data)) {
            data = $.toObj(data);
          }
          resolve(data)
        }
      } catch (e) {
        $.logErr(e, resp)
      } finally {
        reject("发生错误")
      }
    })
  })
}


async function taskUrl(function_id, body) {
  let url = await getSign(function_id, body)
  return {
    url: url,
    body: `body=${escape(JSON.stringify(body))}`,
    headers: h
  }
}

function taskPostUrl(function_id, body, extra) {
  return {
    url: `${JD_API_HOST}client.action?functionId=${function_id}&${extra}`,
    body: `body=${escape(JSON.stringify(body))}`,
    headers: h
  }
}

function TotalBean() {
  return new Promise(async resolve => {
    const options = {
      "url": `https://wq.jd.com/user/info/QueryJDUserInfo?sceneval=2`,
      "headers": {
        "Accept": "application/json,text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-cn",
        "Connection": "keep-alive",
        "Cookie": cookie,
        "Referer": "https://wqs.jd.com/my/jingdou/my.shtml?sceneval=2",
        "User-Agent": $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : (require('./USER_AGENTS').USER_AGENT)) : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0")
      }
    }
    post(options).then(data => {
      if (data['retcode'] === 13)
        $.isLogin = false; //cookie过期
      else $.nickName = data['base'].nickname;
    }).finally(() => resolve())
  })
}

// prettier-ignore
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name},开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name},错误!`,t.stack):this.log("",`❗️${this.name},错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name},结束!🕛${s}秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}safeGet(e){try{if(typeof JSON.parse(e)=="object"){return true}}catch(e){return false}}}(t,e)}
