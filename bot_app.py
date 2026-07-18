import os
import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

bot = Bot(token=os.getenv('BOT_TOKEN'))
dp = Dispatcher()

@dp.message(Command("start"))
async def send_welcome(message: types.Message):
    webapp_url = os.getenv('WEBAPP_URL', 'https://your-domain.loca.lt')
    
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🛍 Открыть магазин", web_app=WebAppInfo(url=webapp_url))]
    ])
    
    await message.answer(
        "🏪 *Добро пожаловать в Digital Store!*\n\nНажмите кнопку ниже, чтобы открыть магазин:",
        parse_mode="Markdown",
        reply_markup=markup
    )

async def start_bot():
    print("🤖 Bot started in polling mode")
    await dp.start_polling(bot)
