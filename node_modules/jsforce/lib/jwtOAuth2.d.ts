import OAuth2, { OAuth2Config } from './oauth2';
/**
 * @deprecated
 */
export declare class JwtOAuth2 extends OAuth2 {
    constructor(config: OAuth2Config);
    jwtAuthorize(innerToken: string): Promise<any>;
}
