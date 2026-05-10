using { mj } from '../db/schema';

service MJService {

  entity MJHistoryEvents as projection on mj.MJHistoryEvents;

}
 