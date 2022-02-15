const { Telegraf, Markup, Stage } = require('telegraf')
const I18n = require('telegraf-i18n')
const winston = require('winston');
const { mongoose, User, Item } = require('./models')
const path = require('path');
const { CryptoPay, Assets, PaidButtonNames } = require('@foile/crypto-pay-api')
require('dotenv').config()

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

const bot = new Telegraf(process.env.BOT_TOKEN)
const i18n = new I18n({
  useSession: true,
  default_language: 'en',
  directory: path.resolve(__dirname, 'locales')
})


bot.use(i18n.middleware())
bot.use(Telegraf.session())

const TEST_NET = true;
let token; let hostname;
if(TEST_NET){
    token = process.env.CRYPTO_PAY_API_TOKEN_TEST
    hostname = 'testnet-pay.crypt.bot'
    logger.info('[CRYPTO_PAY] Using TEST net')
} else {
    token = process.env.CRYPTO_PAY_API_TOKEN
    hostname = 'pay.crypt.bot'
    logger.info('[CRYPTO_PAY] Using REAL net')
}

const cryptoPay = new CryptoPay(token, {
  hostname: hostname,
  protocol: 'https'
});

cryptoPay.getMe()
    .then(res => logger.info(`[CRYPTO_PAY] Successfully started... (app name: "${res['name']}"; net: ${res['payment_processing_bot_username']})`))
    .catch(error => logger.error("[CRYPTO_PAY] Error occurred! " + error))

cryptoPay.getBalance().then(r => {logger.info("[CRYPTO_PAY] Balance:"); r.forEach(el=>{logger.info(el)})})
// cryptoPay.getInvoices().then(r => {logger.info("[CRYPTO_PAY] Invoices:"); logger.info(r)})

// cryptoPay.getCurrencies()
//     .then(r => {
//         logger.info("[CRYPTO_PAY] Currencies:");
//         logger.info(r)
//     })

// cryptoPay.getExchangeRates()
//     .then(r => {
//         logger.info("[CRYPTO_PAY] ExchangeRates:");
//         logger.info(r)
//     })

const listener = (update) => {logger.info("[CRYPTO_PAY] invoicePaid: "); logger.info(update.payload)}
cryptoPay.invoicePaid(listener)

// Telegram bot
const Button = Markup.callbackButton
const UrlButton = Markup.urlButton
const Keyboard = Markup.inlineKeyboard
const MarkdownV2 = (markdown) => {return {parse_mode: 'MarkdownV2', reply_markup: markdown}}
const Buttons = (...btns) => {
    const keyboard = Markup.inlineKeyboard(btns);
    return MarkdownV2(keyboard)
}

const startButtons = Buttons(
    Button('По кайфу!', 'good'),
    Button('Пойдет', 'bad'),
    Button('Buy', 'buy'),
    UrlButton("View item", "http://placekitten.com/600/500")
)

async function greet(ctx){
    const message = ctx.i18n.t('greeting', {
        username: ctx.message.from.username
    })
    await ctx.replyWithHTML(message)
    await ctx.replyWithPhoto(
        {source: "pics/cat.png"},
        startButtons
    )
}


bot.start(async (ctx) => {
    // logger.info("[Telegram bot]"); logger.info(ctx);
    let user_data = ctx.message.from
    let user_id = user_data.id;
    let is_bot = user_data.is_bot
    let first_name = user_data.first_name
    let username = user_data.username
    let lang = user_data.language_code
    let user; let existed;
    await User.findOne({id: user_id})
        .then(usr => {
            if(!usr){
                logger.info('Creating new User...')
                user = new User({
                            id: user_id,
                            is_bot: is_bot,
                            first_name: first_name,
                            username: username,
                            lang: lang
                        })
                user.save()
                existed = false;
            } else {
                logger.info('Getting from DB...')
                user = usr
                existed = true
            }
        })
        .catch(error => {logger.info(error)})
    logger.info(user)
    if(!existed) {
        await greet(ctx)
    }
})

bot.action('good', async (ctx) => {
    await ctx.reply("Красава! Я тоже норм ☺")
    await ctx.answerCbQuery()
})

bot.action('bad', async (ctx) => {
    await ctx.reply("Ну ты это там давай не раскисай")
    await ctx.answerCbQuery();
})

bot.action('buy', async (ctx) => {
    await cryptoPay.createInvoice("BNB", "0.05",
{description:"Buy Useless Stuff! It's cool!",
        hidden_message: "Cool! It useless, but you bought it!",
        expires_in: 120,
        paid_btn_name: PaidButtonNames.VIEW_ITEM,
        paid_btn_url: "http://placekitten.com/600/500"
        })
        .then(res => {
            logger.info("[CRYPTO_PAY] Invoice created: ", res);
            const txt = ctx.i18n.t('buy_text')
            const btn_txt = ctx.i18n.t('buy_btn')
            const url = res.pay_url
            const markdown = MarkdownV2(Keyboard([UrlButton(btn_txt, url)]))
            logger.info(markdown)
            ctx.replyWithHTML(txt, markdown)
        })
        .catch(error => {
            logger.error("[CRYPTO_PAY] " + error);
            ctx.reply("Something went wrong!")
        })
    await ctx.answerCbQuery();
})

bot.settings(async (ctx) => {
    await logger.info('settings here!')
    const message = ctx.i18n.t('settings')
    const btns = Buttons([
        Button('Русский🇷🇺', 'ru'),
        Button('English🇬🇧', 'en'),
        Button(ctx.i18n.t('cancel'), 'lang_cancel')]
    )
    logger.info(btns)
    await ctx.replyWithHTML(message, btns)
})

bot.action('ru', async (ctx) => {
    await ctx.i18n.locale('ru');
    await User.findOne({ id: ctx.from.id }, function (err, doc){
        doc.lang = 'ru';
        doc.save();
    }).clone().catch(function(err){ console.log(err)});
    const message = ctx.i18n.t('lang_changed')
    await ctx.reply(message);
    await ctx.answerCbQuery();
})

bot.action('en', async (ctx) => {
    await ctx.i18n.locale('en');
    await User.findOne({ id: ctx.from.id }, function (err, doc){
        doc.lang = 'en';
        doc.save();
    }).clone().catch(function(err){ console.log(err)});
    const message = ctx.i18n.t('lang_changed')
    await ctx.reply(message);
    await ctx.answerCbQuery();
})

bot.action('lang_cancel', async (ctx) => {

})


bot.launch()
    .then(r => logger.info('[Telegram bot] Successfully started...', {service: "Telegram bot"}))
    .catch(error => logger.error('[Telegram bot] Error occurred! '+ error))
