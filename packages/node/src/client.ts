import { version as PACKAGE_VERSION } from '../gen/version';

import { SkylabConfig, Defaults } from './config';
import { FetchHttpClient } from './transport/http';
import { HttpClient } from './types/transport';
import { SkylabUser } from './types/user';
import { Variant, Variants } from './types/variant';
import { urlSafeBase64Encode } from './util/encode';
import { performance } from './util/performance';

/**
 * Main client for fetching variant data.
 * @category Core Usage
 */
export class SkylabClient {
  protected readonly apiKey: string;
  protected readonly httpClient: HttpClient;

  protected serverUrl: string;
  protected config: SkylabConfig;
  protected user: SkylabUser;
  protected debug: boolean;

  /**
   * Creates a new SkylabClient instance.
   * In most cases, a SkylabClient should be initialized and accessed using
   * the factory functions {@link skylabInit} and {@link skylabInstance}
   * @param apiKey The environment API Key
   * @param config See {@link SkylabConfig} for config options
   */
  public constructor(apiKey: string, config: SkylabConfig) {
    this.apiKey = apiKey;
    this.config = { ...Defaults, ...config };
    this.httpClient = FetchHttpClient;
    this.debug = this.config?.debug;
  }

  // Making a test change to a node src file

  private async fetchAll(
    user: SkylabUser,
  ): Promise<{ [flagKey: string]: Variant }> {
    try {
      const start = performance.now();
      const userContext = this.addContext(user || {});
      const encodedContext = urlSafeBase64Encode(JSON.stringify(userContext));
      const endpoint = `${this.config.serverUrl}/sdk/vardata/${encodedContext}`;
      const headers = {
        Authorization: `Api-Key ${this.apiKey}`,
      };
      const response = await this.httpClient.request(endpoint, 'GET', headers);
      if (response.status === 200) {
        const json = JSON.parse(response.body);
        const end = performance.now();
        const variants: Variants = {};
        for (const key of Object.keys(json)) {
          let value;
          if ('value' in json[key]) {
            value = json[key].value;
          } else if ('key' in json[key]) {
            // value was previously under the "key" field
            value = json[key].key;
          }
          const variant: Variant = {
            value,
            payload: json[key].payload,
          };
          variants[key] = variant;
        }
        this.debug &&
          console.debug(
            `[Skylab] Fetched all variants in ${(end - start).toFixed(3)} ms`,
          );
        return variants;
      } else {
        console.error(`[Skylab] Received ${response.status}: ${response.body}`);
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  }

  private addContext(user: SkylabUser): SkylabUser {
    return {
      library: `skylab-js-server/${PACKAGE_VERSION}`,
      ...user,
    };
  }

  /**
   * Returns all variants for the user
   * @param user The {@link SkylabUser} context
   */
  public async getVariants(user: SkylabUser): Promise<Variants> {
    if (!this.apiKey) {
      return {};
    }
    const variants = await this.fetchAll(user);
    return variants;
  }
}
