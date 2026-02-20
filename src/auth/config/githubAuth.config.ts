import { registerAs } from '@nestjs/config';

export default registerAs('githubOAuth', () => ({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callBackURL: process.env.GITHUB_CLIENT_CALLBACK,
}));
