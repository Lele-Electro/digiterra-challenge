import { AfterContentInit, AfterViewChecked, Component, EventEmitter, Input, OnInit, Output, ViewChild, } from '@angular/core';
import { NgForm } from '@angular/forms';
import { details } from 'src/app/models/customer';

@Component({
  selector: 'app-customer-details',
  templateUrl: './customer-details.component.html',
  styleUrls: ['./customer-details.component.scss'],
})

export class CustomerDetailsComponent implements AfterViewChecked{
  @Input() customerDetails!: details;
  @Output() detailsForm:EventEmitter<NgForm> = new EventEmitter<NgForm>
  @ViewChild('detailsForm') formRef!:NgForm

  outputFormToParentComponent(form:NgForm){
    this.detailsForm.emit(form)
  }

  ngAfterViewChecked(): void {
    this.detailsForm.emit(this.formRef)
  }

}
