import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callEtherscan } from './etherscan-api.js';
import { formatToolResult } from '../types.js';

const CryptoOnchainInputSchema = z.object({
  token_address: z
    .string()
    .describe('ERC20 token contract address (e.g. 0x...). Must be a valid Ethereum address.'),
  chain: z
    .string()
    .default('ethereum')
    .describe("Blockchain to query. Currently only 'ethereum' is supported."),
});

export const getCryptoOnchain = new DynamicStructuredTool({
  name: 'get_crypto_onchain',
  description: `Fetches on-chain holder data for an ERC20 token on Ethereum. Returns top holders, holder count, concentration metrics (top 10 holder %), and whale count (holders with >1% of supply). Requires ETHERSCAN_API_KEY.`,
  schema: CryptoOnchainInputSchema,
  func: async (input) => {
    if (input.chain !== 'ethereum') {
      return formatToolResult(
        { error: `Chain '${input.chain}' is not supported yet. Only 'ethereum' is currently available.` },
        []
      );
    }

    const addr = input.token_address;
    const urls: string[] = [];

    try {
      // Fetch token info
      const tokenInfoResp = await callEtherscan('token', 'tokeninfo', {
        contractaddress: addr,
      });
      urls.push(tokenInfoResp.url);

      // Fetch top token holders
      const holdersResp = await callEtherscan('token', 'tokenholderlist', {
        contractaddress: addr,
        page: '1',
        offset: '20',
      });
      urls.push(holdersResp.url);

      // Parse token info
      const tokenInfo = tokenInfoResp.data.result as Record<string, unknown> | Array<Record<string, unknown>>;
      let totalSupply = 0;
      let decimals = 18;
      let tokenName = '';
      let tokenSymbol = '';

      if (Array.isArray(tokenInfo) && tokenInfo.length > 0) {
        const info = tokenInfo[0];
        totalSupply = Number(info.totalSupply || 0);
        decimals = Number(info.divisor || info.decimals || 18);
        tokenName = String(info.tokenName || '');
        tokenSymbol = String(info.symbol || '');
      } else if (tokenInfo && !Array.isArray(tokenInfo)) {
        totalSupply = Number(tokenInfo.totalSupply || 0);
        decimals = Number(tokenInfo.divisor || tokenInfo.decimals || 18);
        tokenName = String(tokenInfo.tokenName || '');
        tokenSymbol = String(tokenInfo.symbol || '');
      }

      const adjustedTotalSupply = totalSupply / Math.pow(10, decimals);

      // Parse holders
      const holderList = holdersResp.data.result as Array<Record<string, unknown>>;
      if (!Array.isArray(holderList)) {
        return formatToolResult(
          { error: 'Could not retrieve holder data. The contract may not be a standard ERC20 token.' },
          urls
        );
      }

      const top10 = holderList.slice(0, 10);
      const topHolders = top10.map((h) => {
        const balance = Number(h.TokenHolderQuantity || 0) / Math.pow(10, decimals);
        const percentage = adjustedTotalSupply > 0 ? (balance / adjustedTotalSupply) * 100 : 0;
        return {
          address: h.TokenHolderAddress,
          balance: Math.round(balance * 100) / 100,
          percentage: Math.round(percentage * 100) / 100,
        };
      });

      const top10Concentration = topHolders.reduce((sum, h) => sum + h.percentage, 0);

      // Count whales (>1% of supply) from fetched list
      const allHolders = holderList.map((h) => {
        const balance = Number(h.TokenHolderQuantity || 0) / Math.pow(10, decimals);
        return adjustedTotalSupply > 0 ? (balance / adjustedTotalSupply) * 100 : 0;
      });
      const whaleCount = allHolders.filter((pct) => pct > 1).length;

      const result = {
        token: {
          name: tokenName,
          symbol: tokenSymbol,
          address: addr,
          total_supply: adjustedTotalSupply,
          decimals,
        },
        holder_count: holderList.length,
        top_holders: topHolders,
        concentration: {
          top_10_percentage: Math.round(top10Concentration * 100) / 100,
          whale_count: whaleCount,
          whale_threshold: '1% of total supply',
        },
      };

      return formatToolResult(result, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: message }, urls);
    }
  },
});
