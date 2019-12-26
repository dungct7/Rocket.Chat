import { Meteor } from 'meteor/meteor';
import toastr from 'toastr';

import { modal } from '../../ui-utils';
import { t } from '../../utils';

export function process2faReturn({ error, result, originalCallback, onCode, emailOrUsername }) {
	if (!error || error.error !== 'totp-required') {
		return originalCallback(error, result);
	}

	const method = error.details && error.details.method;

	modal.open({
		title: t('Two Factor Authentication'),
		text: t(method === 'email' ? 'Verify_your_email_for_the_code_we_sent' : 'Open_your_authentication_app_and_enter_the_code'),
		html: method === 'email',
		type: 'input',
		inputActionText: method === 'email' && t('Send_me_the_code_again'),
		inputAction(e) {
			window.a = e;
			const { value } = e.currentTarget;
			e.currentTarget.value = 'Sending';
			Meteor.call('sendEmailCode', emailOrUsername, () => {
				e.currentTarget.value = value;
			});
		},
		inputType: 'text',
		showCancelButton: true,
		closeOnConfirm: true,
		confirmButtonText: t('Verify'),
		cancelButtonText: t('Cancel'),
	}, (code) => {
		if (code === false) {
			return originalCallback(new Meteor.Error('totp-canceled'));
		}
		onCode(code, method);
	});
}

const { call } = Meteor;
Meteor.call = function(ddpMethod, ...args) {
	const callback = args.pop();

	if (typeof callback !== 'function') {
		return call(ddpMethod, ...args, callback);
	}

	return call(ddpMethod, ...args, function(error, result) {
		process2faReturn({
			error,
			result,
			originalCallback: callback,
			onCode: (code, method) => {
				call('callWithTwoFactorRequired', { code, ddpMethod, method, params: args }, (error, result) => {
					if (error && error.error === 'totp-invalid') {
						toastr.error(t('Invalid_two_factor_code'));
						return callback(error);
					}

					callback(error, result);
				});
			},
		});
	});
};