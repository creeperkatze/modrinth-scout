import 'dotenv/config'

const port = process.env.PORT ?? '3000'
const token = process.env.KOFI_VERIFICATION_TOKEN ?? '60df80e8-0b32-4102-9e7f-21fdda51ae53'

const payload = {
	verification_token: token,
	message_id: '972a0731-56ab-446b-8f54-9dab9f20365d',
	timestamp: new Date().toISOString(),
	type: 'Donation',
	is_public: true,
	from_name: 'Jo Example',
	message: 'Good luck with the integration!',
	amount: '3.00',
	url: 'https://ko-fi.com/Home/CoffeeShop?txid=00000000-1111-2222-3333-444444444444',
	email: 'jo.example@example.com',
	currency: 'USD',
	is_subscription_payment: false,
	is_first_subscription_payment: false,
	kofi_transaction_id: '00000000-1111-2222-3333-444444444444',
	shop_items: null,
	tier_name: null,
	shipping: null,
	discord_username: 'Jo#4105',
	discord_userid: '0000000000000000000',
}

const body = new URLSearchParams({ data: JSON.stringify(payload) })

const res = await fetch(`http://localhost:${port}/kofi`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
	body,
})

console.log(`${res.status} ${res.statusText}`)
console.log(await res.text())
