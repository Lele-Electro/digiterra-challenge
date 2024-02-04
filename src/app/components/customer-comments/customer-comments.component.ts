import { Component, Input} from '@angular/core';
import { comment, id } from 'src/app/models/customer';
@Component({
  selector: 'app-customer-comments',
  templateUrl: './customer-comments.component.html',
  styleUrls: ['./customer-comments.component.scss'],
})
export class CustomerCommentsComponent {
  @Input() customerCommentRef!: comment;

  logComment(){
    console.log(this.customerCommentRef)
  }



}
