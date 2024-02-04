import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgForm } from '@angular/forms';
import {
  address,
  customer,
  physicalAddress,
  postalAddress,
} from 'src/app/models/customer';

@Component({
  selector: 'app-customer-address',
  templateUrl: './customer-address.component.html',
  styleUrls: ['./customer-address.component.scss'],
})
export class CustomerAddressComponent implements OnInit {

  @Input() addresses!: address;
  @Output() customerCommentUpdate: EventEmitter<address> = new EventEmitter<address>();

  ngOnInit(): void {

  }
}
