import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkedStatus } from "./consulting-course-sandbox";

const id = "course-attempt";
const amount = { country:"CMR", currency:"XAF", amount:"100.00" };
const confirmed = { checkoutId:id, clientReferenceId:id, checkoutCode:"test", status:"COMPLETED",
  amounts:[amount], deposit:{...amount,status:"COMPLETED"} };

test("confirms only the expected course payment", () => {
  assert.equal(checkedStatus(id,"test",confirmed),"COMPLETED");
  for (const change of [{checkoutId:"another"}, {clientReferenceId:"another"}, {checkoutCode:"other"},
    {amounts:[]}, {deposit:undefined}, {deposit:{...amount,status:"FAILED"}},
    {deposit:{...confirmed.deposit,amount:"10"}}, {deposit:{...confirmed.deposit,currency:"USD"}},
    {deposit:{...confirmed.deposit,country:"GHA"}}]) {
    assert.throws(()=>checkedStatus(id,"test",{...confirmed,...change}));
  }
});
test("pending, declined, expired or cancelled attempts grant no access", () => {
  for (const status of ["EXPIRED","FAILED","CANCELLED","WAITING_PAYMENT","PROCESSING","UNKNOWN"]) {
    assert.notEqual(checkedStatus(id,"test",{...confirmed,status}),"COMPLETED");
  }
  assert.equal(checkedStatus(id,null,{...confirmed,status:"WAITING_PAYMENT",deposit:{...amount,status:"FAILED"}}),"PENDING");
});
