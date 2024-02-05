import { AfterViewChecked, Component, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import { NgForm } from '@angular/forms';
import { comment, id } from 'src/app/models/customer';
@Component({
  selector: 'app-customer-comments',
  templateUrl: './customer-comments.component.html',
  styleUrls: ['./customer-comments.component.scss'],
})
export class CustomerCommentsComponent implements AfterViewChecked {
  @Input() customerCommentRef!: comment;
  @Output() commentForm:EventEmitter<NgForm> = new EventEmitter<NgForm>
  @ViewChild('commentForm') commentFormRef!: NgForm

  outputFormToParentComponent(form:NgForm){
    this.commentForm.emit(form)
  }

  ngAfterViewChecked(): void {
    this.outputFormToParentComponent(this.commentFormRef)
  }


}
