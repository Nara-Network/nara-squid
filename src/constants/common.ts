export const OZEAN_API_BASE_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:3000/api' : process.env.OZEAN_API_BASE_URL;

export const SKIP_ACTIVITY_TX_HASHES = [
  '0x12868e66ebc4532fbe5780ad0c7e2b6f9ff76623455820ebaa8fa621c182c792',
  '0xa5b7fa9079a96e5c2b9df1ec4bf72e18f88b2cfeb56d36b6f4e1da1e2e55c145', 
  '0xc3f0dc58cfe2bcbeda40aa1aa76b8855d1003a68df776fe19d602ab844520707',
  '0x8b58caf3a3836d5a1f4050d8553eeddba380b6e25204cc900b6207cbc7d6d439'
]
