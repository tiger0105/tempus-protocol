
import * as YahooFinanceAPIClient from 'yahoo-finance';

interface PriceQuote {
    high: number;
    low: number;
    open: number;
    close: number;
    date: Date;
    symbol: string;
  }
  
const ETH_USD_SYMBOL = 'ETH-USD';
export class EthPriceQuoteProvider {
    /**
     * 
     * @param date the date for which the daily price quote of ETH will be fetched
     * @returns daily price quote of ETH
     */
    static async getDailyQuote(date: Date) : Promise<PriceQuote> {
        const dayBeforeGivenDate = new Date(date.getTime());
        dayBeforeGivenDate.setDate(date.getDate() - 1); // minus 1 day
      
        return await new Promise((resolve, reject) => {
            YahooFinanceAPIClient.historical({
            symbol: ETH_USD_SYMBOL,
            from: dayBeforeGivenDate,
            to: date,
            period: 'd' // daily
            }, (err: Error, quotes: PriceQuote[]) => {
                if (err) {
                    reject(err);
                }
        
                // returns the latest price between dayBeforeGivenDate & date
                resolve(quotes.sort((q1: any, q2: any) => q2.date - q1.date)[0]);
            });
        });
    }
  }